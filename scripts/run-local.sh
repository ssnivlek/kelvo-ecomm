#!/usr/bin/env bash
# ================================================================
# RUM Shop - Run Locally with Docker
# ================================================================
# Starts ALL services (backends + databases + frontend) using
# Docker Compose. No local Java, Node, or Python needed.
#
# Usage:
#   ./scripts/run-local.sh              # Start everything
#   ./scripts/run-local.sh stop         # Stop everything
#   ./scripts/run-local.sh status       # Show running containers
#   ./scripts/run-local.sh logs         # Tail all logs
#   ./scripts/run-local.sh logs <svc>   # Tail logs for one service
# ================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

# ── Check prerequisites ──────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}ERROR: Docker is not installed.${NC}"
  echo "  Install Docker Desktop: https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo -e "${RED}ERROR: Docker is not running.${NC}"
  echo "  Start Docker Desktop and try again."
  exit 1
fi

# ── Check .env ────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  echo -e "${RED}ERROR: .env file not found.${NC}"
  echo ""
  echo "  Run these commands first:"
  echo "    cp .env.local .env"
  echo "    # Then edit .env and fill in your Datadog keys"
  echo ""
  exit 1
fi

# Check for unfilled placeholders
if grep -q '<YOUR_' .env 2>/dev/null; then
  echo -e "${RED}ERROR: .env still has unfilled placeholders:${NC}"
  grep '<YOUR_' .env | head -5
  echo ""
  echo "  Edit .env and replace all <YOUR_...> values."
  exit 1
fi

# ── Commands ──────────────────────────────────────────────────
case "${1:-start}" in
  stop)
    echo -e "${YELLOW}Stopping all RUM Shop containers...${NC}"
    docker compose down
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
    ;;
  status)
    echo ""
    echo -e "${CYAN}RUM Shop — Container Status${NC}"
    echo ""
    docker compose ps
    exit 0
    ;;
  logs)
    if [[ -n "${2:-}" ]]; then
      docker compose logs -f "$2"
    else
      docker compose logs -f
    fi
    exit 0
    ;;
  start) ;;
  *)
    echo "Usage: $0 [start|stop|status|logs [service]]"
    exit 1
    ;;
esac

# ── Start ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          RUM Shop — Starting with Docker             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}[1/3] Starting databases (PostgreSQL + Redis)...${NC}"
docker compose up -d postgres redis
echo -e "  Waiting for databases to be healthy..."

for i in $(seq 1 30); do
  PG_OK=$(docker compose exec -T postgres pg_isready -U rumshop 2>/dev/null && echo "yes" || echo "no")
  RD_OK=$(docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && echo "yes" || echo "no")
  if [[ "$PG_OK" == "yes" && "$RD_OK" == "yes" ]]; then
    echo -e "  ${GREEN}●${NC} PostgreSQL ready on :5432"
    echo -e "  ${GREEN}●${NC} Redis ready on :6379"
    break
  fi
  sleep 1
done

echo ""
echo -e "${YELLOW}[2/3] Starting backend services...${NC}"
docker compose up -d order-service cart-service auth-service payment-service \
  search-service recommendations-service notifications-service

echo ""
echo -e "${YELLOW}[3/3] Starting frontend + tools...${NC}"
docker compose up -d frontend swagger-ui

# Start Datadog Agent if API key is set
if grep -q 'DD_API_KEY=' .env && ! grep -q 'DD_API_KEY=<' .env; then
  docker compose up -d datadog-agent 2>/dev/null || true
fi

echo ""
echo -e "  Waiting for services to start..."
sleep 5

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          RUM Shop — All Services Running             ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Frontend:          http://localhost:3000             ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Swagger UI:        http://localhost:8888             ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Order Service:     http://localhost:8080/api/products${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Cart Service:      http://localhost:3001/health      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Auth Service:      http://localhost:3002/health      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Payment Service:   http://localhost:3003/health      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Search:            http://localhost:3004/health      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Recommendations:   http://localhost:3005/health      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Notifications:     http://localhost:3006/health      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  PostgreSQL:        localhost:5432                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Redis:             localhost:6379                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Logs:   ./scripts/run-local.sh logs                 ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Stop:   ./scripts/run-local.sh stop                 ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Status: ./scripts/run-local.sh status               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Container status:${NC}"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
