# Kelvo-Ecomm

E-commerce app with polyglot microservices on AWS. Instrumented with **Datadog RUM**, **APM**, and **FinOps** right-sizing.

## Architecture

```
                    ┌──────────────────────┐
                    │  S3 + CloudFront     │
                    │  React SPA           │
                    │  Datadog RUM         │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼───────────────┐
              │                │               │
              ▼                ▼               ▼
     ┌─────────────┐  ┌──────────────┐  ┌───────────┐
     │     ALB     │  │     ALB      │  │ API GW    │
     │  /products  │  │ /cart /auth  │  │ /search   │
     │  /orders    │  │ /payment     │  │ /recs     │
     └──────┬──────┘  └──────┬───────┘  └─────┬─────┘
            │                │               │
            ▼                ▼               ▼
     ┌──────────────┐ ┌─────────────┐ ┌───────────────┐
     │  EC2         │ │ ECS Fargate │ │ Lambda        │
     │  t3.large    │ │ 512/1024    │ │ Python 3.11   │
     │  Java 17     │ │ Node.js 20  │ │               │
     │  Spring Boot │ │ dd-trace    │ │ Remote Instr. │
     │  dd-java-    │ │ UDS sockets │ │ (Datadog UI)  │
     │  agent       │ │ Firelens    │ │               │
     └──────┬───────┘ └──────┬──────┘ └───────────────┘
            │                │
     ┌──────┴───────┐ ┌─────┴──────┐
     │  PostgreSQL  │ │   Redis    │
     │  RDS         │ │ ElastiCache│
     │  (orders,    │ │ (carts,    │
     │   users)     │ │  payments) │
     └──────────────┘ └────────────┘
            │                │
            └────────┬───────┘
                     ▼
            ┌──────────────────┐
            │  Datadog Agent   │
            │  APM · Logs · DBM│
            │  Metrics · FinOps│
            └──────────────────┘
```

## Services

| Service | Language | AWS | Port | DD Service |
|---------|----------|-----|------|------------|
| Orders | Java 17 | EC2 (t3.large) | 8080 | `rum-shop-order-service` |
| Cart | Node.js 20 | ECS Fargate | 3001 | `rum-shop-cart` |
| Auth | Node.js 20 | ECS Fargate | 3002 | `rum-shop-auth` |
| Payment | Node.js 20 | ECS Fargate | 3003 | `rum-shop-payment` |
| Search | Python 3.11 | Lambda | 3004 | `rum-shop-search` |
| Recommendations | Python 3.11 | Lambda | 3005 | `rum-shop-recommendations` |
| Notifications | Python 3.11 | Lambda | 3006 | `rum-shop-notifications` |
| Frontend | React/TS | S3 + CloudFront | 3000 | `kelvo-ecomm` |

## Databases

| Database | AWS Service | Local | Used By |
|----------|-------------|-------|---------|
| PostgreSQL 16 | RDS (db.t3.medium) | Docker `postgres:16-alpine` :5432 | Order Service (products, orders), Auth Service (users) |
| Redis 7 | ElastiCache (cache.t3.small) | Docker `redis:7-alpine` :6379 | Cart Service (sessions), Payment Service (intents) |

Python Lambda services use a static product catalog (no DB connection needed — avoids VPC cold start penalty).

## FinOps Right-Sizing

Resources are oversized so Datadog Cloud Cost Management recommends downsizing.

| Resource | Deployed | Ideal | Savings |
|----------|----------|-------|---------|
| EC2 | t3.large (2 vCPU, 8 GB) ~$60/mo | t3.small ~$15/mo | ~$45/mo |
| ECS x3 | 512 CPU / 1024 MB ~$54/mo | 256/512 ~$27/mo | ~$27/mo |
| RDS | db.t3.medium (2 vCPU, 4 GB) ~$50/mo | db.t3.micro ~$12/mo | ~$38/mo |
| ElastiCache | cache.t3.small (1.5 GB) ~$25/mo | cache.t3.micro ~$12/mo | ~$13/mo |
| **Total** | **~$189/mo** | **~$66/mo** | **~$123/mo** |

## Datadog Instrumentation

### RUM (Frontend)

Uses `@datadog/browser-rum` with RUM-to-APM trace correlation. All keys come from environment variables (never hardcoded).

```typescript
datadogRum.init({
  applicationId: process.env.REACT_APP_DD_APPLICATION_ID,
  clientToken: process.env.REACT_APP_DD_CLIENT_TOKEN,
  site: 'datadoghq.com',
  service: 'kelvo-ecomm',
  env: process.env.REACT_APP_DD_ENV,
  version: '1.0.0',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 20,
  trackResources: true,
  trackUserInteractions: true,
  trackLongTasks: true,
  allowedTracingUrls: [
    { match: /^http:\/\/localhost/, propagatorTypes: ['datadog', 'tracecontext'] },
    { match: (url) => url.includes('.amazonaws.com'), propagatorTypes: ['datadog', 'tracecontext'] },
  ],
});
```

`allowedTracingUrls` injects `x-datadog-trace-id`, `x-datadog-parent-id`, `traceparent`, and `tracestate` headers into backend requests, linking RUM sessions to APM traces end-to-end. See [Connect RUM and Traces](https://docs.datadoghq.com/real_user_monitoring/platform/connect_rum_and_traces/).

### Java APM (EC2)

- Datadog Agent installed on EC2 via install script
- `dd-java-agent.jar` as `-javaagent` JVM flag
- Profiling and log injection enabled

### Node.js APM (ECS Fargate)

- Dockerfile: `NODE_OPTIONS='--require=dd-trace/init' node server.js`
- Datadog Agent sidecar in each task definition
- UDS sockets: agent and app share `/var/run/datadog` volume
- Firelens (fluent-bit) routes logs to Datadog

### Python APM (Lambda - Remote Instrumentation)

Lambda functions are deployed **without** Datadog layers. Instrumented via [Datadog Remote Instrumentation](https://docs.datadoghq.com/serverless/aws_lambda/installation/):

1. Go to **APM > Service Setup > Serverless**
2. Click **Remotely instrument in Datadog > Open Serverless**
3. **+ Enable Region** for your deployment region
4. **Select Functions**: choose the `rumshop-*` functions
5. Configure APM/Tracing + Logs, then **Confirm**

### Database Monitoring (DBM)

Datadog Agent monitors both databases for query performance, slow queries, explain plans, and connection health.

**PostgreSQL (RDS / local)**

The `datadog` user is created automatically:
- **Local**: `infrastructure/postgres-init.sql` runs on first `docker-compose up` via `/docker-entrypoint-initdb.d/`
- **AWS**: Run the init script against RDS after deployment (see `deploy-aws.sh` output)

Permissions granted:
- `pg_monitor` role (read access to `pg_stat_*`, locks, activity)
- `datadog` schema with `explain_statement()` function for query plan collection
- `SELECT` on all public tables for DBM query samples

The Agent collects via [Autodiscovery](https://docs.datadoghq.com/database_monitoring/setup_postgres/) labels (local) or `postgres.d/conf.yaml` (EC2/RDS).

**Redis (ElastiCache / local)**

No special user needed -- Redis is monitored via the `redisdb` check.
The Agent collects: memory usage, connected clients, evicted keys, hit/miss rates, command latency, and slowlog.

Configured via Autodiscovery labels (local) or `redisdb.d/conf.yaml` (EC2 → ElastiCache).

**Where the Agent runs:**
- **Local**: The `dd-agent` container auto-discovers PostgreSQL and Redis via Docker labels
- **AWS**: The Datadog Agent on the EC2 instance monitors both RDS and ElastiCache (Agent config in EC2 UserData)

### Docker Compose (local)

Datadog Agent uses UDS sockets (`DD_APM_RECEIVER_SOCKET=/var/run/datadog/apm.socket`). All services mount the shared `dd-sockets` volume. Database containers have Autodiscovery labels for automatic DBM setup.

## Quick Start

### Docker Compose

```bash
cp .env.local .env
# Edit .env: set DD_API_KEY, DD_RUM_APPLICATION_ID, DD_RUM_CLIENT_TOKEN
docker-compose up -d
```

- Frontend: http://localhost:3000
- Swagger UI: http://localhost:8888
- PostgreSQL: `localhost:5432` (user: rumshop / rumshop)
- Redis: `localhost:6379`

### Run locally

```bash
cd backend/python-lambdas && pip install -r requirements.txt flask flask-cors && cd ../..
cd backend/nodejs-lambdas && npm install && cd ../..
cd frontend && npm install && cd ..

./scripts/run-local.sh         # all backends
cd frontend && npm start       # frontend
```

### Deploy to AWS

```bash
# 1. Set up AWS CLI
aws configure

# 2. Fill in .env.aws
# Set: AWS_REGION, AWS_ACCOUNT_ID, DD_API_KEY, DD_APP_KEY,
#      DD_RUM_APPLICATION_ID, DD_RUM_CLIENT_TOKEN, EC2_KEY_PAIR_NAME,
#      JWT_SECRET, RDS_PASSWORD

# 3. Deploy
./scripts/deploy-aws.sh

# 4. Enable Lambda Remote Instrumentation in Datadog UI

# 5. Teardown when done
./scripts/teardown-aws.sh
```

## Environment Variables

| File | Usage |
|------|-------|
| `.env.local` | Local dev (Docker Compose / run-local.sh) |
| `.env.aws` | AWS deployment |
| `frontend/.env.example` | React env vars reference |

### Required Datadog Values

| Variable | Source |
|----------|--------|
| `DD_API_KEY` | [API Keys](https://app.datadoghq.com/organization-settings/api-keys) |
| `DD_APP_KEY` | [Application Keys](https://app.datadoghq.com/organization-settings/application-keys) |
| `DD_RUM_APPLICATION_ID` | [RUM App](https://app.datadoghq.com/rum/application/create) |
| `DD_RUM_CLIENT_TOKEN` | Same page as Application ID |
| `DD_SITE` | `datadoghq.com` / `datadoghq.eu` / `us3.datadoghq.com` / `us5.datadoghq.com` / `ap1.datadoghq.com` |

**No API keys, application keys, or tokens are hardcoded anywhere.** All sensitive values are loaded from environment variables at build/runtime.

## API Reference

Full OpenAPI 3.0 spec: `docs/openapi.yaml` — Swagger UI at `http://localhost:8888` when running Docker Compose.

Curl examples: `./docs/api-examples.sh`

### Orders (EC2 Java) — `/api/products`, `/api/orders`

`GET /api/products` · `GET /api/products/{id}` · `GET /api/products/search?q=` · `POST /api/products` · `PUT /api/products/{id}/stock` · `POST /api/orders` · `GET /api/orders/{id}` · `PUT /api/orders/{id}/status`

### Cart (ECS Node.js) — `/api/cart`

`POST /api/cart/add` · `GET /api/cart/{sessionId}` · `PUT /api/cart/update` · `DELETE /api/cart/{sessionId}/item/{productId}` · `DELETE /api/cart/{sessionId}`

### Auth (ECS Node.js) — `/api/auth`

`POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/profile`

### Payment (ECS Node.js) — `/api/payment`

`POST /api/payment/create-intent` · `POST /api/payment/confirm` · `POST /api/payment/webhook`

### Search (Lambda Python) — `/api/search`

`GET /api/search?q=&category=&minPrice=&maxPrice=&sort=`

### Recommendations (Lambda Python) — `/api/recommendations`

`GET /api/recommendations?productId={id}&limit=4`

### Notifications (Lambda Python) — `/api/notifications`

`POST /api/notifications/order-confirmation` · `POST /api/notifications/shipping-update`

## Demo Credentials

`demo@rumshop.com` / `password123`
