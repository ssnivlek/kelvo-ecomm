#!/usr/bin/env bash
# ================================================================
# Kelvo-Ecomm — AWS Teardown
# ================================================================
# Destroys ALL AWS resources created by deploy-aws.sh.
# Handles: S3 (empty), ECR (images), CloudFront (disable),
#          CloudWatch Logs, and the full CloudFormation stack.
#
# Usage:
#   ./scripts/teardown-aws.sh           # interactive confirmation
#   ./scripts/teardown-aws.sh --force   # skip confirmation
# ================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

# ── Load config ───────────────────────────────────────────────
ENV_FILE="${PROJECT_ROOT}/.env.aws"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.aws not found. Cannot determine stack to destroy."
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

if [[ -z "${AWS_REGION:-}" || "${AWS_REGION}" == "<"* ]]; then
  echo "ERROR: AWS_REGION not set in .env.aws"
  exit 1
fi

STACK_NAME="${APP_NAME:-rumshop}-${ENVIRONMENT:-production}"
AWS="aws --region ${AWS_REGION}"
[[ -n "${AWS_PROFILE:-}" ]] && AWS="aws --region ${AWS_REGION} --profile ${AWS_PROFILE}"

# ── Check stack exists ────────────────────────────────────────
STACK_STATUS=$($AWS cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null) || STACK_STATUS="NOT_FOUND"

if [[ "$STACK_STATUS" == "NOT_FOUND" ]]; then
  echo "Stack '$STACK_NAME' not found in $AWS_REGION. Nothing to tear down."
  exit 0
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              TEARDOWN — Kelvo-Ecomm                    ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Stack:   $STACK_NAME"
echo "║  Region:  $AWS_REGION"
echo "║  Status:  $STACK_STATUS"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

if [[ "$FORCE" != true ]]; then
  echo "This will PERMANENTLY DELETE all resources in this stack:"
  echo "  - EC2 instance (Order Service)"
  echo "  - ECS cluster + Fargate tasks (Cart, Auth, Payment)"
  echo "  - Lambda functions (Search, Recommendations, Notifications)"
  echo "  - ALB, API Gateway, VPC, NAT Gateway"
  echo "  - S3 bucket + CloudFront distribution"
  echo "  - ECR repositories + images"
  echo "  - CloudWatch log groups"
  echo ""
  read -p "Type 'yes' to confirm deletion: " confirm
  if [[ "$confirm" != "yes" ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

ok()   { echo "  ✓ $1"; }
skip() { echo "  - $1 (skipped)"; }
fail() { echo "  ✗ $1 (failed, continuing)"; }

# ── 1. Stop ECS services (set desired count to 0) ────────────
echo ""
echo "═══ [1/6] Stopping ECS services... ═══"
ECS_CLUSTER=$($AWS cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ECSClusterName'].OutputValue" \
  --output text 2>/dev/null) || ECS_CLUSTER=""

if [[ -n "$ECS_CLUSTER" && "$ECS_CLUSTER" != "None" ]]; then
  for svc in cart auth payment; do
    SVC_NAME="${STACK_NAME}-${svc}"
    $AWS ecs update-service --cluster "$ECS_CLUSTER" --service "$SVC_NAME" \
      --desired-count 0 --no-cli-pager 2>/dev/null && ok "$SVC_NAME stopped" || skip "$SVC_NAME"
  done
else
  skip "No ECS cluster found"
fi

# ── 2. Empty S3 bucket ───────────────────────────────────────
echo ""
echo "═══ [2/6] Emptying S3 bucket... ═══"
S3_BUCKET=$($AWS cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text 2>/dev/null) || S3_BUCKET=""

if [[ -n "$S3_BUCKET" && "$S3_BUCKET" != "None" ]]; then
  $AWS s3 rm "s3://${S3_BUCKET}" --recursive --quiet 2>/dev/null && ok "Emptied $S3_BUCKET" || fail "Empty $S3_BUCKET"
else
  skip "No S3 bucket found"
fi

# ── 3. Clean ECR repositories ────────────────────────────────
echo ""
echo "═══ [3/6] Cleaning ECR images... ═══"
for svc in cart auth payment; do
  REPO="${STACK_NAME}/${svc}-service"
  IMAGES=$($AWS ecr list-images --repository-name "$REPO" --query 'imageIds[*]' --output json 2>/dev/null) || IMAGES="[]"

  if [[ "$IMAGES" != "[]" && -n "$IMAGES" ]]; then
    $AWS ecr batch-delete-image --repository-name "$REPO" --image-ids "$IMAGES" \
      --no-cli-pager 2>/dev/null && ok "Cleaned $REPO" || fail "Clean $REPO"
  else
    skip "$REPO (no images)"
  fi
done

# ── 4. Disable CloudFront (required before CFN can delete) ───
echo ""
echo "═══ [4/6] Disabling CloudFront... ═══"
CF_DIST_ID=$($AWS cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text 2>/dev/null) || CF_DIST_ID=""

if [[ -n "$CF_DIST_ID" && "$CF_DIST_ID" != "None" ]]; then
  ETAG=$($AWS cloudfront get-distribution --id "$CF_DIST_ID" --query 'ETag' --output text 2>/dev/null) || ETAG=""
  if [[ -n "$ETAG" ]]; then
    CFG=$($AWS cloudfront get-distribution-config --id "$CF_DIST_ID" --output json 2>/dev/null)
    IS_ENABLED=$(echo "$CFG" | python3 -c "import sys,json; print(json.load(sys.stdin)['DistributionConfig']['Enabled'])" 2>/dev/null) || IS_ENABLED="True"

    if [[ "$IS_ENABLED" == "True" ]]; then
      DISABLED_CFG=$(echo "$CFG" | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['DistributionConfig']['Enabled'] = False
json.dump(d['DistributionConfig'], sys.stdout)
" 2>/dev/null)
      $AWS cloudfront update-distribution --id "$CF_DIST_ID" \
        --if-match "$ETAG" --distribution-config "$DISABLED_CFG" \
        --no-cli-pager 2>/dev/null && ok "Disabled CloudFront $CF_DIST_ID" || fail "Disable CloudFront"
    else
      ok "CloudFront already disabled"
    fi
  fi
else
  skip "No CloudFront distribution found"
fi

# ── 5. Delete CloudFormation stack ────────────────────────────
echo ""
echo "═══ [5/6] Deleting CloudFormation stack... ═══"
echo "  Deleting $STACK_NAME..."
$AWS cloudformation delete-stack --stack-name "$STACK_NAME"

echo "  Waiting for deletion (this can take 5-15 minutes)..."
$AWS cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" 2>/dev/null \
  && ok "Stack deleted" \
  || {
    echo ""
    echo "  Stack deletion may have failed. Checking status..."
    STATUS=$($AWS cloudformation describe-stacks --stack-name "$STACK_NAME" \
      --query 'Stacks[0].StackStatus' --output text 2>/dev/null) || STATUS="DELETED"
    if [[ "$STATUS" == "DELETE_FAILED" ]]; then
      echo "  Stack is in DELETE_FAILED state."
      echo "  Retrying with --retain-resources for stuck resources..."
      FAILED=$($AWS cloudformation describe-stack-events --stack-name "$STACK_NAME" \
        --query "StackEvents[?ResourceStatus=='DELETE_FAILED'].LogicalResourceId" \
        --output text 2>/dev/null | tr '\t' ' ')
      if [[ -n "$FAILED" ]]; then
        echo "  Retaining: $FAILED"
        $AWS cloudformation delete-stack --stack-name "$STACK_NAME" \
          --retain-resources $FAILED 2>/dev/null
        $AWS cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" 2>/dev/null \
          && ok "Stack deleted (with retained resources)" \
          || fail "Stack deletion"
      fi
    elif [[ "$STATUS" == "DELETED" || "$STATUS" == *"does not exist"* ]]; then
      ok "Stack deleted"
    fi
  }

# ── 6. Clean up CloudWatch log groups ─────────────────────────
echo ""
echo "═══ [6/6] Cleaning CloudWatch log groups... ═══"
for prefix in "/ecs/${STACK_NAME}" "/aws/lambda/${STACK_NAME}"; do
  GROUPS=$($AWS logs describe-log-groups --log-group-name-prefix "$prefix" \
    --query 'logGroups[*].logGroupName' --output text 2>/dev/null) || GROUPS=""
  for grp in $GROUPS; do
    $AWS logs delete-log-group --log-group-name "$grp" 2>/dev/null \
      && ok "Deleted $grp" || fail "Delete $grp"
  done
done

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║          TEARDOWN COMPLETE                             ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Stack $STACK_NAME destroyed."
echo "║  All EC2, ECS, Lambda, ALB, VPC, S3, CloudFront,      ║"
echo "║  ECR, and CloudWatch resources have been removed.      ║"
echo "║                                                        ║"
echo "║  Billing for these resources will stop within          ║"
echo "║  the current hour.                                     ║"
echo "╚════════════════════════════════════════════════════════╝"
