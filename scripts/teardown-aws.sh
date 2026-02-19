#!/usr/bin/env bash
# ================================================================
# RUM Shop - AWS Teardown Script
# ================================================================
# Destroys all AWS resources created by deploy-aws.sh.
# Run this when you're done with the lab to stop costs.
#
# Usage: ./scripts/teardown-aws.sh
# ================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV_FILE="${PROJECT_ROOT}/.env.aws"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.aws not found."
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

STACK_NAME="${APP_NAME:-rumshop}-${ENVIRONMENT:-production}"
AWS_CMD="aws --region ${AWS_REGION}"
[ -n "${AWS_PROFILE:-}" ] && AWS_CMD="aws --region ${AWS_REGION} --profile ${AWS_PROFILE}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       RUM Shop - AWS TEARDOWN                       ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Stack: ${STACK_NAME}"
echo "║  Region: ${AWS_REGION}"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

read -p "Are you sure you want to DELETE all resources? (type 'yes'): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Cancelled."
  exit 0
fi

# Empty S3 bucket first (CloudFormation can't delete non-empty buckets)
echo "═══ Emptying S3 frontend bucket... ═══"
S3_BUCKET=$($AWS_CMD cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text 2>/dev/null) || true

if [[ -n "$S3_BUCKET" && "$S3_BUCKET" != "None" ]]; then
  $AWS_CMD s3 rm "s3://${S3_BUCKET}" --recursive 2>/dev/null || true
fi

# Delete ECR images
echo "═══ Cleaning ECR repositories... ═══"
for svc in cart auth payment; do
  repo="${STACK_NAME}/${svc}-service"
  $AWS_CMD ecr batch-delete-image \
    --repository-name "$repo" \
    --image-ids "$(${AWS_CMD} ecr list-images --repository-name "$repo" --query 'imageIds[*]' --output json 2>/dev/null)" \
    2>/dev/null || true
done

# Delete CloudFormation stack
echo "═══ Deleting CloudFormation stack... ═══"
$AWS_CMD cloudformation delete-stack --stack-name "$STACK_NAME"

echo "═══ Waiting for stack deletion... ═══"
$AWS_CMD cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       TEARDOWN COMPLETE - All resources deleted      ║"
echo "╚══════════════════════════════════════════════════════╝"
