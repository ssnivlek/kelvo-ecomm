#!/usr/bin/env bash
# ================================================================
# watch-deploy.sh — Full deploy watcher (all phases)
# Monitors: CloudFormation → Docker/ECR → ECS tasks → Frontend → URL
# ================================================================
# Usage:
#   ./scripts/watch-deploy.sh                        # prompts for stack + region
#   ./scripts/watch-deploy.sh my-stack us-east-1     # args
#   STACK_NAME=my-stack AWS_REGION=us-east-1 ./scripts/watch-deploy.sh
# ================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

# ── Resolve stack name ─────────────────────────────────────────
if [[ -n "${1:-}" ]]; then
  STACK="${1}"
elif [[ -n "${STACK_NAME:-}" ]]; then
  STACK="${STACK_NAME}"
else
  printf "${BOLD}Stack name${NC} [e.g. myapp-production]: "
  read -r STACK
  [[ -z "$STACK" ]] && { echo -e "${RED}ERROR: stack name required.${NC}"; exit 1; }
fi

# ── Resolve region ─────────────────────────────────────────────
if [[ -n "${2:-}" ]]; then
  REGION="${2}"
elif [[ -n "${AWS_REGION:-}" ]]; then
  REGION="${AWS_REGION}"
elif [[ -n "${AWS_DEFAULT_REGION:-}" ]]; then
  REGION="${AWS_DEFAULT_REGION}"
else
  DEFAULT_REGION=$(aws configure get region 2>/dev/null || echo "")
  PROMPT="Region"
  [[ -n "$DEFAULT_REGION" ]] && PROMPT="Region [${DEFAULT_REGION}]"
  printf "${BOLD}${PROMPT}${NC}: "
  read -r REGION
  REGION="${REGION:-$DEFAULT_REGION}"
  [[ -z "$REGION" ]] && { echo -e "${RED}ERROR: region required.${NC}"; exit 1; }
fi

# ── AWS command base ───────────────────────────────────────────
AWS="aws --region ${REGION}"
[[ -n "${AWS_PROFILE:-}" ]] && AWS="aws --region ${REGION} --profile ${AWS_PROFILE}"

echo ""
echo -e "${BOLD}Stack:${NC}  ${CYAN}${STACK}${NC}"
echo -e "${BOLD}Region:${NC} ${CYAN}${REGION}${NC}"
[[ -n "${AWS_PROFILE:-}" ]] && echo -e "${BOLD}Profile:${NC} ${CYAN}${AWS_PROFILE}${NC}"
echo "────────────────────────────────────────────────────────"

# ──────────────────────────────────────────────────────────────
# PHASE 1: CloudFormation events
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[1/4] CloudFormation stack${NC}"

status_color() {
  case "$1" in
    *COMPLETE*)  echo -e "${GREEN}${1}${NC}" ;;
    *FAILED*)    echo -e "${RED}${1}${NC}" ;;
    *PROGRESS*)  echo -e "${YELLOW}${1}${NC}" ;;
    *)           echo -e "${CYAN}${1}${NC}" ;;
  esac
}

SEEN=()

while true; do
  STACK_STATUS=$(${AWS} cloudformation describe-stacks \
    --stack-name "${STACK}" \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null) || STACK_STATUS=""

  if [[ -z "$STACK_STATUS" || "$STACK_STATUS" == "None" ]]; then
    info "Waiting for stack to appear..."
    sleep 5
    continue
  fi

  EVENTS=$(${AWS} cloudformation describe-stack-events \
    --stack-name "${STACK}" \
    --query 'StackEvents[0:50].[EventId,Timestamp,LogicalResourceId,ResourceType,ResourceStatus,ResourceStatusReason]' \
    --output text 2>/dev/null) || EVENTS=""

  while IFS=$'\t' read -r event_id ts resource_id resource_type status reason; do
    [[ -z "$event_id" ]] && continue
    already=false
    for seen_id in "${SEEN[@]:-}"; do [[ "$seen_id" == "$event_id" ]] && already=true && break; done
    [[ "$already" == true ]] && continue
    SEEN+=("${event_id}")
    ts_short=$(echo "${ts}" | sed 's/T/ /' | cut -c1-19)
    printf "  ${BOLD}%-20s${NC} %-30s %-40s " "${ts_short}" "${resource_id}" "${resource_type}"
    status_color "${status}"
    [[ -n "${reason}" && "${reason}" != "None" ]] && echo -e "    ${CYAN}${reason}${NC}"
  done <<< "${EVENTS}"

  case "${STACK_STATUS}" in
    CREATE_COMPLETE|UPDATE_COMPLETE|IMPORT_COMPLETE)
      ok "Stack ${STACK_STATUS}"
      break
      ;;
    *FAILED*|ROLLBACK_COMPLETE|UPDATE_ROLLBACK_COMPLETE)
      fail "Stack ${STACK_STATUS}"
      echo ""
      echo -e "${RED}Failed resources:${NC}"
      ${AWS} cloudformation describe-stack-events \
        --stack-name "${STACK}" \
        --query 'StackEvents[?contains(ResourceStatus,`FAILED`)].[LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
        --output table 2>/dev/null
      exit 1
      ;;
  esac

  sleep 5
done

# Get stack outputs
FRONTEND_URL=$(${AWS} cloudformation describe-stacks --stack-name "${STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendURL'].OutputValue" \
  --output text 2>/dev/null) || FRONTEND_URL=""
S3_BUCKET=$(${AWS} cloudformation describe-stacks --stack-name "${STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text 2>/dev/null) || S3_BUCKET=""
ECS_CLUSTER=$(${AWS} cloudformation describe-stacks --stack-name "${STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='ECSClusterName'].OutputValue" \
  --output text 2>/dev/null) || ECS_CLUSTER=""
CF_DIST_ID=$(${AWS} cloudformation describe-stacks --stack-name "${STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text 2>/dev/null) || CF_DIST_ID=""

SVCS=(cart auth payment)

# ──────────────────────────────────────────────────────────────
# PHASE 2: Docker images → ECR
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[2/4] Docker images → ECR${NC}"

ecr_image_count() {
  local repo="${STACK}/${1}-service"
  ${AWS} ecr list-images --repository-name "$repo" \
    --query 'length(imageIds)' --output text 2>/dev/null || echo "0"
}

ECR_ELAPSED=0
MAX_ECR_WAIT=900

while true; do
  all_done=true
  for svc in "${SVCS[@]}"; do
    cnt=$(ecr_image_count "$svc")
    [[ "$cnt" == "None" || -z "$cnt" ]] && cnt=0
    if [[ "$cnt" -gt 0 ]]; then
      ok "${svc}-service: image in ECR (${cnt} tag(s))"
    else
      info "${svc}-service: waiting for image push... (${ECR_ELAPSED}s)"
      all_done=false
    fi
  done

  [[ "$all_done" == true ]] && break

  if [[ $ECR_ELAPSED -ge $MAX_ECR_WAIT ]]; then
    warn "Images not all in ECR after ${MAX_ECR_WAIT}s — continuing"
    break
  fi

  sleep 10
  ECR_ELAPSED=$((ECR_ELAPSED + 10))

  # Clear last lines and reprint (move up 3 lines)
  echo -ne "\033[${#SVCS[@]}A"
done

# ──────────────────────────────────────────────────────────────
# PHASE 3: ECS tasks running
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[3/4] ECS tasks${NC}"

if [[ -z "$ECS_CLUSTER" || "$ECS_CLUSTER" == "None" ]]; then
  warn "No ECS cluster in stack outputs — skipping"
else
  ECS_ELAPSED=0
  MAX_ECS_WAIT=600

  while true; do
    all_running=true
    for svc in "${SVCS[@]}"; do
      SVC_NAME="${STACK}-${svc}"
      RUNNING=$(${AWS} ecs describe-services --cluster "$ECS_CLUSTER" \
        --services "$SVC_NAME" \
        --query 'services[0].runningCount' --output text 2>/dev/null) || RUNNING=0
      DESIRED=$(${AWS} ecs describe-services --cluster "$ECS_CLUSTER" \
        --services "$SVC_NAME" \
        --query 'services[0].desiredCount' --output text 2>/dev/null) || DESIRED=1
      [[ "$RUNNING" == "None" || -z "$RUNNING" ]] && RUNNING=0
      [[ "$DESIRED" == "None" || -z "$DESIRED" ]] && DESIRED=1

      if [[ "$DESIRED" -gt 0 && "$RUNNING" -ge "$DESIRED" ]]; then
        ok "${SVC_NAME}: ${RUNNING}/${DESIRED} running"
      else
        # Check for stopped tasks to surface errors quickly
        STOPPED_REASON=$(${AWS} ecs describe-services --cluster "$ECS_CLUSTER" \
          --services "$SVC_NAME" \
          --query 'services[0].events[0].message' --output text 2>/dev/null) || STOPPED_REASON=""
        info "${SVC_NAME}: ${RUNNING}/${DESIRED} running... (${ECS_ELAPSED}s)"
        [[ -n "$STOPPED_REASON" && "$STOPPED_REASON" != "None" ]] && \
          echo -e "    ${CYAN}${STOPPED_REASON}${NC}"
        all_running=false
      fi
    done

    [[ "$all_running" == true ]] && break

    if [[ $ECS_ELAPSED -ge $MAX_ECS_WAIT ]]; then
      warn "ECS services not fully running after ${MAX_ECS_WAIT}s"
      break
    fi

    sleep 10
    ECS_ELAPSED=$((ECS_ELAPSED + 10))
    echo -ne "\033[${#SVCS[@]}A"
  done
fi

# ──────────────────────────────────────────────────────────────
# PHASE 4: Frontend (S3 + CloudFront)
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[4/4] Frontend${NC}"

if [[ -z "$S3_BUCKET" || "$S3_BUCKET" == "None" ]]; then
  warn "No S3 bucket in stack outputs — skipping"
else
  S3_ELAPSED=0
  MAX_S3_WAIT=600
  S3_DONE=false

  while [[ $S3_ELAPSED -lt $MAX_S3_WAIT ]]; do
    COUNT=$(${AWS} s3api list-objects-v2 --bucket "$S3_BUCKET" \
      --query 'KeyCount' --output text 2>/dev/null) || COUNT=0
    [[ "$COUNT" == "None" || -z "$COUNT" ]] && COUNT=0

    if [[ "$COUNT" -gt 0 ]]; then
      ok "Frontend uploaded: ${COUNT} files in s3://${S3_BUCKET}"
      S3_DONE=true
      break
    else
      echo -ne "  ${CYAN}→${NC} S3 bucket empty — waiting for npm build + upload... (${S3_ELAPSED}s)\r"
      sleep 10
      S3_ELAPSED=$((S3_ELAPSED + 10))
    fi
  done

  echo ""
  [[ "$S3_DONE" != true ]] && warn "Frontend not uploaded after ${MAX_S3_WAIT}s"

  # CloudFront invalidation
  if [[ -n "$CF_DIST_ID" && "$CF_DIST_ID" != "None" ]]; then
    INV=$(${AWS} cloudfront list-invalidations --distribution-id "$CF_DIST_ID" \
      --query 'InvalidationList.Items[0].Status' --output text 2>/dev/null) || INV=""
    if [[ -n "$INV" && "$INV" != "None" ]]; then
      ok "CloudFront invalidation: ${INV}"
    fi
  fi
fi

# ──────────────────────────────────────────────────────────────
# DONE — all outputs + UI URL
# ──────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}${BOLD}  DEPLOY COMPLETE${NC}"
echo "════════════════════════════════════════════════════════"
${AWS} cloudformation describe-stacks --stack-name "${STACK}" \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table 2>/dev/null
echo "════════════════════════════════════════════════════════"
if [[ -n "$FRONTEND_URL" && "$FRONTEND_URL" != "None" ]]; then
  echo ""
  echo -e "  ${BOLD}Frontend UI:${NC} ${GREEN}${BOLD}${FRONTEND_URL}${NC}"
  echo ""
fi
