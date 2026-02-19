#!/usr/bin/env bash
# ================================================================
# RUM Shop - Full AWS Deployment Script
# ================================================================
# Deploys: CloudFormation stack (VPC, EC2, ECS, Lambda, S3, CF)
#          + builds and pushes Docker images to ECR
#          + uploads Lambda code
#          + deploys frontend to S3
#          + deploys Java JAR to EC2 via SSM
#
# Usage:
#   1. Fill in .env.aws with your values
#   2. Ensure AWS CLI is configured (aws configure or AWS_PROFILE)
#   3. Run: ./scripts/deploy-aws.sh
# ================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ── Load config ───────────────────────────────────────────────
ENV_FILE="${PROJECT_ROOT}/.env.aws"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.aws not found. Copy .env.aws and fill in your values."
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

# ── Validate required vars ────────────────────────────────────
REQUIRED_VARS=(
  AWS_REGION AWS_ACCOUNT_ID DD_API_KEY DD_APP_KEY DD_SITE
  DD_RUM_APPLICATION_ID DD_RUM_CLIENT_TOKEN EC2_KEY_PAIR_NAME
  EC2_INSTANCE_TYPE JWT_SECRET RDS_PASSWORD
)
for var in "${REQUIRED_VARS[@]}"; do
  val="${!var:-}"
  if [[ -z "$val" || "$val" == "<"* ]]; then
    echo "ERROR: $var is not set in .env.aws (found: '${val:-empty}')"
    exit 1
  fi
done

STACK_NAME="${APP_NAME:-rumshop}-${ENVIRONMENT:-production}"
AWS_CMD="aws --region ${AWS_REGION}"
[ -n "${AWS_PROFILE:-}" ] && AWS_CMD="aws --region ${AWS_REGION} --profile ${AWS_PROFILE}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         RUM Shop - AWS Deployment                   ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Stack:    ${STACK_NAME}"
echo "║  Region:   ${AWS_REGION}"
echo "║  Account:  ${AWS_ACCOUNT_ID}"
echo "║  EC2 Type: ${EC2_INSTANCE_TYPE} (oversized for FinOps)"
echo "║  Fargate:  ${FARGATE_CPU:-512}CPU / ${FARGATE_MEMORY:-1024}MB (oversized)"
echo "║  RDS:      ${RDS_INSTANCE_CLASS:-db.t3.medium} (oversized for FinOps)"
echo "║  Redis:    ${ELASTICACHE_NODE_TYPE:-cache.t3.small} (oversized for FinOps)"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Deploy CloudFormation stack ───────────────────────
echo "═══ [1/6] Deploying CloudFormation stack... ═══"
$AWS_CMD cloudformation deploy \
  --template-file "${PROJECT_ROOT}/infrastructure/aws-architecture.yaml" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides \
    Environment="${ENVIRONMENT:-production}" \
    DatadogApiKey="${DD_API_KEY}" \
    DatadogAppKey="${DD_APP_KEY}" \
    DatadogRumApplicationId="${DD_RUM_APPLICATION_ID}" \
    DatadogRumClientToken="${DD_RUM_CLIENT_TOKEN}" \
    DatadogSite="${DD_SITE}" \
    EC2KeyPairName="${EC2_KEY_PAIR_NAME}" \
    EC2InstanceType="${EC2_INSTANCE_TYPE}" \
    FargateCpu="${FARGATE_CPU:-512}" \
    FargateMemory="${FARGATE_MEMORY:-1024}" \
    JwtSecret="${JWT_SECRET}" \
    RDSInstanceClass="${RDS_INSTANCE_CLASS:-db.t3.medium}" \
    RDSPassword="${RDS_PASSWORD}" \
    ElastiCacheNodeType="${ELASTICACHE_NODE_TYPE:-cache.t3.small}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --tags \
    env="${ENVIRONMENT:-production}" \
    project=rumshop \
    managed-by=deploy-script \
  --no-fail-on-empty-changeset

# ── Fetch stack outputs ───────────────────────────────────────
echo ""
echo "═══ Fetching stack outputs... ═══"
OUTPUTS=$($AWS_CMD cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs' --output json)
get_output() { echo "$OUTPUTS" | python3 -c "import sys,json; o={x['OutputKey']:x['OutputValue'] for x in json.load(sys.stdin)}; print(o.get('$1',''))" ; }

ALB_URL=$(get_output ALBURL)
APIGW_URL=$(get_output ApiGatewayURL)
FRONTEND_URL=$(get_output FrontendURL)
EC2_INSTANCE_ID=$(get_output EC2InstanceId)
EC2_PUBLIC_IP=$(get_output EC2PublicIP)
ECS_CLUSTER=$(get_output ECSClusterName)
S3_BUCKET=$(get_output FrontendBucketName)
CF_DIST_ID=$(get_output CloudFrontDistributionId)
RDS_ENDPOINT=$(get_output RDSEndpoint)
REDIS_ENDPOINT=$(get_output RedisEndpoint)

echo "  ALB URL:       $ALB_URL"
echo "  API GW URL:    $APIGW_URL"
echo "  Frontend URL:  $FRONTEND_URL"
echo "  RDS Endpoint:  $RDS_ENDPOINT"
echo "  Redis Endpoint: $REDIS_ENDPOINT"
echo "  EC2 Instance:  $EC2_INSTANCE_ID ($EC2_PUBLIC_IP)"
echo "  ECS Cluster:   $ECS_CLUSTER"
echo "  S3 Bucket:     $S3_BUCKET"

ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# ── Step 2: Build & push Docker images to ECR ─────────────────
echo ""
echo "═══ [2/6] Building and pushing ECS Docker images... ═══"

$AWS_CMD ecr get-login-password | docker login --username AWS --password-stdin "$ECR_BASE"

for svc in cart auth payment; do
  echo "  Building ${svc}-service..."
  REPO="${STACK_NAME}/${svc}-service"
  IMAGE="${ECR_BASE}/${REPO}:latest"

  docker build \
    -f "${PROJECT_ROOT}/backend/nodejs-lambdas/Dockerfile.${svc}" \
    -t "$IMAGE" \
    "${PROJECT_ROOT}/backend/nodejs-lambdas/"

  echo "  Pushing ${svc}-service to ECR..."
  docker push "$IMAGE"
done

# ── Step 3: Update ECS services ───────────────────────────────
echo ""
echo "═══ [3/6] Updating ECS Fargate services... ═══"

for svc in cart auth payment; do
  echo "  Force new deployment: ${STACK_NAME}-${svc}..."
  $AWS_CMD ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "${STACK_NAME}-${svc}" \
    --force-new-deployment \
    --query 'service.serviceName' --output text
done

# ── Step 4: Build & deploy Java JAR to EC2 ────────────────────
echo ""
echo "═══ [4/6] Building Java Order Service and deploying to EC2... ═══"

if command -v mvn &>/dev/null || [[ -f "${PROJECT_ROOT}/backend/java-order-service/mvnw" ]]; then
  cd "${PROJECT_ROOT}/backend/java-order-service"
  if [[ -f mvnw ]]; then
    chmod +x mvnw
    ./mvnw clean package -DskipTests -q
  else
    mvn clean package -DskipTests -q
  fi

  JAR_PATH=$(ls target/order-service-*.jar 2>/dev/null | head -1)
  if [[ -n "$JAR_PATH" ]]; then
    echo "  Uploading JAR via SSM..."
    # Upload JAR to S3 then pull from EC2
    S3_JAR_KEY="deploy/order-service.jar"
    $AWS_CMD s3 cp "$JAR_PATH" "s3://${S3_BUCKET}/${S3_JAR_KEY}"

    $AWS_CMD ssm send-command \
      --instance-ids "$EC2_INSTANCE_ID" \
      --document-name "AWS-RunShellScript" \
      --parameters "commands=[
        'aws s3 cp s3://${S3_BUCKET}/${S3_JAR_KEY} /opt/rumshop/order-service.jar --region ${AWS_REGION}',
        'systemctl restart rumshop-order'
      ]" \
      --query 'Command.CommandId' --output text
    echo "  JAR deployed and service restarting on EC2."
  else
    echo "  WARNING: No JAR found. Skipping EC2 deploy."
  fi
  cd "$PROJECT_ROOT"
else
  echo "  WARNING: Maven not found. Skipping Java build."
  echo "  Build manually: cd backend/java-order-service && ./mvnw package"
fi

# ── Step 5: Deploy Python Lambda code ─────────────────────────
echo ""
echo "═══ [5/7] Deploying Python Lambda functions... ═══"

LAMBDA_ZIP="/tmp/rumshop-lambdas.zip"
cd "${PROJECT_ROOT}/backend/python-lambdas"
rm -f "$LAMBDA_ZIP"
zip -r "$LAMBDA_ZIP" shared/ search/ recommendations/ notifications/ -x '*__pycache__*' '*.pyc'

for func in search recommendations notifications; do
  echo "  Updating ${STACK_NAME}-${func}..."
  $AWS_CMD lambda update-function-code \
    --function-name "${STACK_NAME}-${func}" \
    --zip-file "fileb://${LAMBDA_ZIP}" \
    --query 'FunctionName' --output text
done
cd "$PROJECT_ROOT"

# ── Step 6: Datadog Remote Instrumentation for Lambda ─────────
echo ""
echo "═══ [6/7] Datadog Remote Instrumentation (Lambda)... ═══"
echo ""
echo "  Lambda functions are deployed WITHOUT Datadog layers."
echo "  Instrumentation is handled by Datadog Remote Instrumentation."
echo ""
echo "  ┌─────────────────────────────────────────────────────────┐"
echo "  │ NEXT STEPS (manual, one-time):                          │"
echo "  │                                                         │"
echo "  │ 1. Go to Datadog > APM > Service Setup                 │"
echo "  │ 2. Click 'Add an Entity'                                │"
echo "  │ 3. Select 'Serverless (Lambda Functions)'               │"
echo "  │ 4. Under 'Remotely instrument in Datadog', click        │"
echo "  │    'Open Serverless'                                    │"
echo "  │ 5. Click '+ Enable Region' and select: ${AWS_REGION}   │"
echo "  │ 6. Click 'Select Functions' and choose:                 │"
echo "  │    - ${STACK_NAME}-search                               │"
echo "  │    - ${STACK_NAME}-recommendations                      │"
echo "  │    - ${STACK_NAME}-notifications                        │"
echo "  │ 7. Configure APM/Tracing and Logs, then Confirm         │"
echo "  │                                                         │"
echo "  │ The Remote Instrumenter will automatically inject        │"
echo "  │ Datadog layers and env vars via CloudTrail events.       │"
echo "  └─────────────────────────────────────────────────────────┘"
echo ""

# ── Step 7: Build & deploy React frontend ─────────────────────
echo ""
echo "═══ [7/7] Building and deploying React frontend... ═══"

cd "${PROJECT_ROOT}/frontend"

cat > .env <<ENVEOF
REACT_APP_DD_APPLICATION_ID=${DD_RUM_APPLICATION_ID}
REACT_APP_DD_CLIENT_TOKEN=${DD_RUM_CLIENT_TOKEN}
REACT_APP_DD_SITE=${DD_SITE}
REACT_APP_DD_ENV=${ENVIRONMENT:-production}
REACT_APP_ORDER_API=${ALB_URL}
REACT_APP_CART_API=${ALB_URL}
REACT_APP_AUTH_API=${ALB_URL}
REACT_APP_PAYMENT_API=${ALB_URL}
REACT_APP_SEARCH_API=${APIGW_URL}
REACT_APP_RECOMMENDATIONS_API=${APIGW_URL}
REACT_APP_NOTIFICATIONS_API=${APIGW_URL}
ENVEOF

npm ci
npm run build

echo "  Uploading to S3..."
$AWS_CMD s3 sync build/ "s3://${S3_BUCKET}/" --delete

echo "  Invalidating CloudFront cache..."
$AWS_CMD cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text

cd "$PROJECT_ROOT"

# ── Step: Configure DBM user on RDS ────────────────────────────
echo ""
echo "═══ Configuring Datadog DBM user on RDS... ═══"
echo "  RDS Endpoint: $RDS_ENDPOINT"
echo ""
echo "  Run the following commands to create the Datadog monitoring"
echo "  user on RDS (requires psql or SSM connection to the EC2):"
echo ""
echo "  PGPASSWORD='${RDS_PASSWORD}' psql -h ${RDS_ENDPOINT} -U rumshop -d rumshop -f infrastructure/postgres-init.sql"
echo ""
echo "  Or via SSM on the EC2 instance:"
echo "  aws ssm send-command --instance-ids ${EC2_INSTANCE_ID} \\"
echo "    --document-name 'AWS-RunShellScript' \\"
echo "    --parameters 'commands=[\"PGPASSWORD=\\\"${RDS_PASSWORD}\\\" psql -h ${RDS_ENDPOINT} -U rumshop -d rumshop <<SQL"
echo "CREATE USER datadog WITH PASSWORD \\\"datadog\\\";"
echo "GRANT pg_monitor TO datadog;"
echo "GRANT SELECT ON pg_stat_database TO datadog;"
echo "CREATE SCHEMA IF NOT EXISTS datadog;"
echo "GRANT USAGE ON SCHEMA datadog TO datadog;"
echo "GRANT USAGE ON SCHEMA public TO datadog;"
echo "GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;"
echo "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;"
echo "SQL"
echo "\"]'"
echo ""

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║            DEPLOYMENT COMPLETE                      ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                     ║"
echo "║  Frontend:    ${FRONTEND_URL}"
echo "║  Orders API:  ${ALB_URL}/api/products"
echo "║  Cart API:    ${ALB_URL}/api/cart"
echo "║  Auth API:    ${ALB_URL}/api/auth"
echo "║  Payment API: ${ALB_URL}/api/payment"
echo "║  Search API:  ${APIGW_URL}/api/search"
echo "║  Recs API:    ${APIGW_URL}/api/recommendations"
echo "║  PostgreSQL:  ${RDS_ENDPOINT}"
echo "║  Redis:       ${REDIS_ENDPOINT}"
echo "║                                                     ║"
echo "║  Instrumentation:                                   ║"
echo "║  - EC2 Java: dd-java-agent (auto)                   ║"
echo "║  - ECS Node: dd-trace/init + UDS sockets + Firelens ║"
echo "║  - Lambda:   Datadog Remote Instrumentation (UI)    ║"
echo "║  - Frontend: @datadog/browser-rum                   ║"
echo "║  - DBM:      Agent on EC2 → RDS PostgreSQL          ║"
echo "║  - Redis:    Agent on EC2 → ElastiCache             ║"
echo "║                                                     ║"
echo "║  FinOps targets (Datadog will recommend):           ║"
echo "║  - EC2: ${EC2_INSTANCE_TYPE} → t3.small             ║"
echo "║  - ECS: ${FARGATE_CPU:-512}/${FARGATE_MEMORY:-1024} → 256/512 ║"
echo "║  - RDS: ${RDS_INSTANCE_CLASS:-db.t3.medium} → db.t3.micro    ║"
echo "║  - Redis: ${ELASTICACHE_NODE_TYPE:-cache.t3.small} → cache.t3.micro ║"
echo "║  - Total savings: ~\$123/mo (52%)                   ║"
echo "║                                                     ║"
echo "╚══════════════════════════════════════════════════════╝"
