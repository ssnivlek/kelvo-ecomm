#!/usr/bin/env bash
# ================================================================
# RUM Shop - Run All Services Locally
# ================================================================
# Starts all backend services + frontend for local development.
# Uses .env.local for configuration.
#
# Usage:
#   ./scripts/run-local.sh          # Start all services
#   ./scripts/run-local.sh stop     # Stop all services
#   ./scripts/run-local.sh status   # Show running services
# ================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_DIR="${PROJECT_ROOT}/.pids"
LOG_DIR="${PROJECT_ROOT}/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

# ── Load config ───────────────────────────────────────────────
ENV_FILE="${PROJECT_ROOT}/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

stop_all() {
  echo -e "${YELLOW}Stopping all RUM Shop services...${NC}"
  for pidfile in "$PID_DIR"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    svc=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo -e "  ${RED}Stopped${NC} $svc (PID $pid)"
    fi
    rm -f "$pidfile"
  done
  echo -e "${GREEN}All services stopped.${NC}"
}

show_status() {
  echo -e "\n${CYAN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║          RUM Shop - Service Status           ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════════╣${NC}"
  for pidfile in "$PID_DIR"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    svc=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${CYAN}║${NC}  ${GREEN}●${NC} $svc (PID $pid)"
    else
      echo -e "${CYAN}║${NC}  ${RED}●${NC} $svc (dead)"
    fi
  done
  echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
}

start_service() {
  local name="$1" cmd="$2" dir="$3" port="${4:-}"

  if [[ -n "$port" ]]; then
    # Kill anything already on this port
    lsof -ti :"$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
  fi

  echo -e "  ${BLUE}Starting${NC} $name..."
  cd "$dir"
  eval "nohup $cmd > '${LOG_DIR}/${name}.log' 2>&1 &"
  local pid=$!
  echo "$pid" > "${PID_DIR}/${name}.pid"

  if [[ -n "$port" ]]; then
    # Wait for port to be available (max 30s)
    for i in $(seq 1 30); do
      if lsof -ti :"$port" &>/dev/null; then
        echo -e "  ${GREEN}●${NC} $name running on port $port (PID $pid)"
        return
      fi
      sleep 1
    done
    echo -e "  ${YELLOW}○${NC} $name started (PID $pid), port $port may still be loading"
  else
    echo -e "  ${GREEN}●${NC} $name started (PID $pid)"
  fi
  cd "$PROJECT_ROOT"
}

case "${1:-start}" in
  stop)  stop_all; exit 0 ;;
  status) show_status; exit 0 ;;
  start) ;;
  *) echo "Usage: $0 [start|stop|status]"; exit 1 ;;
esac

# ── Stop existing services first ──────────────────────────────
stop_all 2>/dev/null || true

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      RUM Shop - Starting Local Services      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Java Order Service (EC2 simulation) ────────────────────
echo -e "${YELLOW}[1/5] Java Order Service (port 8080)${NC}"
if [[ -f "${PROJECT_ROOT}/backend/java-order-service/mvnw" ]]; then
  start_service "order-service" \
    "./mvnw spring-boot:run -Dspring-boot.run.jvmArguments='-Xmx512m'" \
    "${PROJECT_ROOT}/backend/java-order-service" \
    "8080"
else
  echo -e "  ${YELLOW}Skipped${NC} - no mvnw found (build with Maven first)"
fi

# ── 2. Node.js Services (ECS Fargate simulation) ─────────────
echo -e "\n${YELLOW}[2/5] Node.js Cart Service (port 3001)${NC}"
cd "${PROJECT_ROOT}/backend/nodejs-lambdas"
[[ -d node_modules ]] || npm install --silent
cd "$PROJECT_ROOT"

NODE_BIN=$(command -v node 2>/dev/null || echo "/opt/homebrew/opt/node@24/bin/node")

start_service "cart-service" \
  "DD_SERVICE=rum-shop-cart DD_ENV=local PORT=3001 '$NODE_BIN' '$(cat "${PROJECT_ROOT}/backend/nodejs-lambdas/Dockerfile.cart" | grep -A1 "COPY.*server.js" | head -1 | awk '{print $2}' 2>/dev/null || echo "server.js")'" \
  "${PROJECT_ROOT}/backend/nodejs-lambdas" \
  "3001" 2>/dev/null || \
start_service "cart-service" \
  "DD_TRACE_ENABLED=false DD_SERVICE=rum-shop-cart PORT=3001 '$NODE_BIN' -e \"
const http=require('http');
const {handler}=require('./cart/handler');
const s=http.createServer(async(q,r)=>{
  if(q.method==='OPTIONS'){r.writeHead(200,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'*','Access-Control-Allow-Headers':'*'});return r.end()}
  if(q.url==='/health'){r.writeHead(200);return r.end(JSON.stringify({status:'ok'}))}
  let b='';q.on('data',c=>b+=c);q.on('end',async()=>{
    const u=new URL(q.url,'http://localhost');
    const m=u.pathname.match(/\\/api\\/cart\\/([^/]+)(\\/item\\/([^/]+))?\$/);
    const e={httpMethod:q.method,path:u.pathname,pathParameters:m?{sessionId:m[1],productId:m[3]}:{},body:b||null,headers:{}};
    try{const res=await handler(e,{});const h=res.headers||{};h['Content-Type']='application/json';r.writeHead(res.statusCode,h);r.end(res.body)}
    catch(err){r.writeHead(500);r.end(JSON.stringify({error:err.message}))}
  })
});
s.listen(3001,()=>console.log('Cart on 3001'));
\"" \
  "${PROJECT_ROOT}/backend/nodejs-lambdas" \
  "3001"

echo -e "\n${YELLOW}[3/5] Node.js Auth Service (port 3002)${NC}"
start_service "auth-service" \
  "DD_TRACE_ENABLED=false DD_SERVICE=rum-shop-auth PORT=3002 JWT_SECRET='${JWT_SECRET:-rum-shop-local-secret}' '$NODE_BIN' -e \"
const http=require('http');
const {handler}=require('./auth/handler');
const s=http.createServer(async(q,r)=>{
  if(q.method==='OPTIONS'){r.writeHead(200,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'*','Access-Control-Allow-Headers':'*'});return r.end()}
  if(q.url==='/health'){r.writeHead(200);return r.end(JSON.stringify({status:'ok'}))}
  let b='';q.on('data',c=>b+=c);q.on('end',async()=>{
    const e={httpMethod:q.method,path:q.url,body:b||null,headers:{Authorization:q.headers.authorization||''}};
    try{const res=await handler(e,{});const h=res.headers||{};h['Content-Type']='application/json';r.writeHead(res.statusCode,h);r.end(res.body)}
    catch(err){r.writeHead(500);r.end(JSON.stringify({error:err.message}))}
  })
});
s.listen(3002,()=>console.log('Auth on 3002'));
\"" \
  "${PROJECT_ROOT}/backend/nodejs-lambdas" \
  "3002"

echo -e "\n${YELLOW}[4/5] Node.js Payment Service (port 3003)${NC}"
start_service "payment-service" \
  "DD_TRACE_ENABLED=false DD_SERVICE=rum-shop-payment PORT=3003 '$NODE_BIN' -e \"
const http=require('http');
const {handler}=require('./payment/handler');
const s=http.createServer(async(q,r)=>{
  if(q.method==='OPTIONS'){r.writeHead(200,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'*','Access-Control-Allow-Headers':'*'});return r.end()}
  if(q.url==='/health'){r.writeHead(200);return r.end(JSON.stringify({status:'ok'}))}
  let b='';q.on('data',c=>b+=c);q.on('end',async()=>{
    const e={httpMethod:q.method,path:q.url,body:b||null,headers:{}};
    try{const res=await handler(e,{});const h=res.headers||{};h['Content-Type']='application/json';r.writeHead(res.statusCode,h);r.end(res.body)}
    catch(err){r.writeHead(500);r.end(JSON.stringify({error:err.message}))}
  })
});
s.listen(3003,()=>console.log('Payment on 3003'));
\"" \
  "${PROJECT_ROOT}/backend/nodejs-lambdas" \
  "3003"

# ── 3. Python Services (Lambda simulation) ────────────────────
echo -e "\n${YELLOW}[5/5] Python Lambda Services (ports 3004-3006)${NC}"
PY=$(command -v python3)

for svc_info in "search:3004:rum-shop-search" "recommendations:3005:rum-shop-recommendations" "notifications:3006:rum-shop-notifications"; do
  IFS=: read -r svc port dd_svc <<< "$svc_info"
  echo -e "  Starting ${svc}..."
  start_service "python-${svc}" \
    "DD_TRACE_ENABLED=false DD_SERVICE=${dd_svc} PORT=${port} '$PY' -c \"
import sys; sys.path.insert(0,'.')
from flask import Flask, request, jsonify; from flask_cors import CORS
import json
from ${svc}.handler import handler
app = Flask(__name__)
CORS(app)
@app.route('/api/${svc}', methods=['GET','POST','OPTIONS'])
@app.route('/api/${svc}/<path:p>', methods=['GET','POST','OPTIONS'])
def handle(p=''):
    event = {'httpMethod':request.method,'path':request.full_path.rstrip('?'),'queryStringParameters':dict(request.args),'body':json.dumps(request.get_json(silent=True)) if request.is_json else None,'headers':dict(request.headers)}
    r = handler(event,{})
    return app.response_class(r['body'],status=r['statusCode'],headers=r.get('headers',{}),mimetype='application/json')
@app.route('/health')
def health(): return jsonify({'status':'ok','service':'${dd_svc}'})
app.run(host='0.0.0.0',port=${port})
\"" \
    "${PROJECT_ROOT}/backend/python-lambdas" \
    "$port"
done

# ── Summary ───────────────────────────────────────────────────
sleep 2
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       RUM Shop - All Services Running                ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Order Service (Java/EC2):    http://localhost:8080   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Cart Service (Node/Fargate): http://localhost:3001   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Auth Service (Node/Fargate): http://localhost:3002   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Payment     (Node/Fargate):  http://localhost:3003   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Search      (Python/Lambda): http://localhost:3004   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Recommend.  (Python/Lambda): http://localhost:3005   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Notify.     (Python/Lambda): http://localhost:3006   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Frontend: cd frontend && npm start                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}            → http://localhost:3000                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Logs: .logs/<service>.log                           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Stop: ./scripts/run-local.sh stop                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                      ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
