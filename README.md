# Kelvo E-Comm

E-commerce application with polyglot microservices on AWS. Full observability with **Datadog RUM**, **APM**, **DBM**, and **FinOps** right-sizing recommendations.

---

## Architecture

```
                +---------------------------+
                |    S3 + CloudFront        |
                |    React SPA              |
                |    Datadog RUM            |
                +-------------+-------------+
                              |
            +-----------------+-----------------+
            |                 |                 |
            v                 v                 v
  +-------------------+  +------------------+  +----------------------+
  |       ALB         |  |       ALB        |  |     API Gateway      |
  |  /api/products    |  |  /api/cart       |  |  /api/search         |
  |  /api/orders      |  |  /api/auth       |  |  /api/recommendations|
  |                   |  |  /api/payment    |  |  /api/notifications  |
  +---------+---------+  +--------+---------+  +----------+-----------+
            |                     |                        |
            v                     v                        v
  +-------------------+  +------------------+  +----------------------+
  |       EC2         |  |   ECS Fargate    |  |       Lambda         |
  |  Java 17          |  |   Node.js 20     |  |   Python 3.11        |
  |  Spring Boot      |  |   dd-trace       |  |                      |
  |  dd-java-agent    |  |   UDS sockets    |  |   Remote Instr.      |
  |  Datadog Agent    |  |   Firelens logs  |  |   (Datadog UI)       |
  +---------+---------+  +--------+---------+  +----------------------+
            |                     |
            v                     v
  +-------------------+  +------------------+
  |   PostgreSQL 16   |  |    Redis 7       |
  |   RDS             |  |    ElastiCache   |
  |   orders, users   |  |    carts,        |
  |                   |  |    payments      |
  +---------+---------+  +--------+---------+
            |                     |
            +---------+-----------+
                      |
                      v
            +-------------------+
            |   Datadog Agent   |
            |   APM  Logs  DBM  |
            |   Metrics  FinOps |
            +-------------------+
```

---

## Services

| Service | Language | AWS | Local Port | DD Service Name |
|---------|----------|-----|------------|-----------------|
| Orders | Java 17 (Spring Boot) | EC2 `t3.large` | 8080 | `kelvo-ecomm-order-service` |
| Cart | Node.js 20 | ECS Fargate | 3001 | `kelvo-ecomm-cart` |
| Auth | Node.js 20 | ECS Fargate | 3002 | `kelvo-ecomm-auth` |
| Payment | Node.js 20 | ECS Fargate | 3003 | `kelvo-ecomm-payment` |
| Search | Python 3.11 | Lambda | 3004 | `kelvo-ecomm-search` |
| Recommendations | Python 3.11 | Lambda | 3005 | `kelvo-ecomm-recommendations` |
| Notifications | Python 3.11 | Lambda | 3006 | `kelvo-ecomm-notifications` |
| Frontend | React + TypeScript | S3 + CloudFront | 3000 | `kelvo-ecomm` |

---

## Databases

| Database | AWS Service | Local Container | Port | Used By |
|----------|-------------|-----------------|------|---------|
| PostgreSQL 16 | RDS (`db.t3.medium`) | `postgres:16-alpine` | 5432 | Order Service (products, orders), Auth Service (users) |
| Redis 7 | ElastiCache (`cache.t3.small`) | `redis:7-alpine` | 6379 | Cart Service (sessions), Payment Service (payment intents) |

Python Lambda services use a static product catalog and do **not** connect to any database. This avoids placing Lambdas inside the VPC, which would add cold start latency.

### How services connect to databases

| Service | Database | Connection String |
|---------|----------|-------------------|
| Order Service (Java) | PostgreSQL | `jdbc:postgresql://<host>:5432/rumshop` (user: `rumshop`, password: `rumshop`) |
| Auth Service (Node.js) | PostgreSQL | `postgresql://rumshop:rumshop@<host>:5432/rumshop` |
| Cart Service (Node.js) | Redis | `redis://<host>:6379` |
| Payment Service (Node.js) | Redis | `redis://<host>:6379` |

Where `<host>` is:
- **Local**: `localhost` (or the Docker service name `postgres` / `redis` inside Docker Compose)
- **AWS**: The RDS endpoint (e.g. `rumshop-postgres.abc123.us-east-1.rds.amazonaws.com`) or ElastiCache endpoint (e.g. `rumshop-redis.abc123.0001.use1.cache.amazonaws.com`)

---

## Network Architecture

### Local (Docker Compose)

All containers run on a single Docker network called `rumshop`. Services reference each other by container name:

```
+------------------------------------------------------------------+
|  Docker Network: rumshop                                         |
|                                                                  |
|  +----------------+       +--------------------+                 |
|  |  frontend      |       |  order-service     |                 |
|  |  :3000         +------>|  :8080 (Java)      +------+         |
|  |                |       +--------------------+      |         |
|  |                |       +--------------------+      |         |
|  |                +------>|  cart-service       |      |         |
|  |                |       |  :3001 (Node.js)   +---+  |         |
|  |                |       +--------------------+   |  |         |
|  |                |       +--------------------+   |  |         |
|  |                +------>|  auth-service       |   |  |         |
|  |                |       |  :3002 (Node.js)   +---+--+         |
|  |                |       +--------------------+   |  |         |
|  |                |       +--------------------+   |  |         |
|  |                +------>|  payment-service    |   |  |         |
|  |                |       |  :3003 (Node.js)   +---+  |         |
|  +----------------+       +--------------------+   |  |         |
|                                                    |  |         |
|                                                    v  v         |
|  +--------------------+          +-----------------+--+------+  |
|  |  dd-agent           |          |  postgres       |  redis  |  |
|  |  Datadog Agent      +--------->|  :5432          |  :6379  |  |
|  |  APM + DBM + Redis  |          |  (PostgreSQL)   |  (Redis)|  |
|  +--------------------+          +------------------+---------+  |
|                                                                  |
|  +--------------------+                                          |
|  |  swagger-ui :8888  |                                          |
|  +--------------------+                                          |
+------------------------------------------------------------------+
```

Every container exposes its port to `localhost` for direct access. Inside Docker, services use the container name as hostname (e.g., `postgres`, `redis`).

### AWS (CloudFormation)

The CloudFormation template creates a dedicated VPC with public and private subnets:

```
+-----------------------------------------------------------------------+
|  VPC  10.0.0.0/16                                                     |
|                                                                       |
|  +-- PUBLIC SUBNETS  10.0.1.0/24 (AZ-a)  10.0.2.0/24 (AZ-b) -----+ |
|  |                                                                  | |
|  |  +---------------------+     +--------------------------------+ | |
|  |  |  ALB  :80           |     |  EC2  t3.large                 | | |
|  |  |                     |     |                                | | |
|  |  |  /api/products  ----+---->|  Java Order Service  :8080     | | |
|  |  |  /api/orders    ----+---->|                                | | |
|  |  |  /api/cart      ----+-+   |  Datadog Agent installed:      | | |
|  |  |  /api/auth      ----+-+-->|    APM  (dd-java-agent)        | | |
|  |  |  /api/payment   ----+-+   |    DBM  --> RDS PostgreSQL     | | |
|  |  |                     |     |    Redis --> ElastiCache        | | |
|  |  +---------------------+     +--------------------------------+ | |
|  |                                                                  | |
|  |  +------------------+        +------------------+                | |
|  |  |  NAT Gateway     |        |  Internet Gateway|                | |
|  |  |  (private->out)  |        |  (public access) |                | |
|  |  +------------------+        +------------------+                | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  +-- PRIVATE SUBNETS  10.0.3.0/24 (AZ-a)  10.0.4.0/24 (AZ-b) ----+ |
|  |                                                                  | |
|  |  +------------------------------------------------------------+ | |
|  |  |  ECS Fargate                                                | | |
|  |  |                                                             | | |
|  |  |  Cart Service     :3001   <-- ALB                           | | |
|  |  |  Auth Service     :3002   <-- ALB                           | | |
|  |  |  Payment Service  :3003   <-- ALB                           | | |
|  |  |                                                             | | |
|  |  |  + Datadog Agent sidecar per task (UDS sockets)             | | |
|  |  |  + Firelens (fluent-bit) for log routing                    | | |
|  |  +---------------------+----------------------+----------------+ | |
|  |                        |                      |                  | |
|  |                        v                      v                  | |
|  |  +---------------------+------+  +------------+--------------+  | |
|  |  |  RDS                       |  |  ElastiCache              |  | |
|  |  |  PostgreSQL 16             |  |  Redis 7                  |  | |
|  |  |  db.t3.medium              |  |  cache.t3.small           |  | |
|  |  |  :5432                     |  |  :6379                    |  | |
|  |  |  NOT publicly accessible   |  |  NOT publicly accessible |  | |
|  |  +----------------------------+  +---------------------------+  | |
|  +------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+

+-----------------------------------------------------------------------+
|  OUTSIDE VPC                                                          |
|                                                                       |
|  API Gateway (HTTP) --> Lambda (Search, Recommendations, Notif.)      |
|  S3 + CloudFront    --> React SPA (static files)                      |
+-----------------------------------------------------------------------+
```

### Security Groups (who can talk to whom)

| Security Group | Allows Inbound From | Ports | Purpose |
|----------------|---------------------|-------|---------|
| `ALBSecurityGroup` | `0.0.0.0/0` (internet) | 80, 443 | Public access to the ALB |
| `EC2SecurityGroup` | `ALBSecurityGroup` | 8080 | ALB routes to Java service |
| `EC2SecurityGroup` | `0.0.0.0/0` | 22 | SSH access (use a key pair) |
| `ECSSecurityGroup` | `ALBSecurityGroup` | 3001-3003 | ALB routes to Node.js services |
| `DatabaseSecurityGroup` | `EC2SecurityGroup` | 5432 | EC2 (Java app + DD Agent) → PostgreSQL |
| `DatabaseSecurityGroup` | `ECSSecurityGroup` | 5432 | ECS (Auth service) → PostgreSQL |
| `RedisSecurityGroup` | `ECSSecurityGroup` | 6379 | ECS (Cart, Payment) → Redis |
| `RedisSecurityGroup` | `EC2SecurityGroup` | 6379 | EC2 (DD Agent) → Redis |

Key points:
- RDS and ElastiCache are in **private subnets** — they are **not** accessible from the internet
- The EC2 instance is in a **public subnet** because it needs the Datadog Agent to reach `datadoghq.com`
- ECS Fargate tasks are in **private subnets** and reach the internet via the **NAT Gateway**
- Lambda functions are **outside the VPC** entirely (no DB connection = no VPC = fast cold starts)
- The Datadog Agent on EC2 connects to both RDS and ElastiCache through the security groups above

---

## Databases — Setup Guide

### Local (Docker Compose)

Everything starts automatically with `./scripts/run-local.sh`. This brings up:
- **PostgreSQL** on `localhost:5432` (database: `rumshop`, user: `rumshop`, password: `rumshop`)
- **Redis** on `localhost:6379` (no password)
- All backend services, pre-configured to connect to these databases
- Datadog Agent with Autodiscovery for DBM

PostgreSQL creates the application tables on first boot (the services use auto-migration). The `datadog` monitoring user is also created automatically from `infrastructure/postgres-init.sql` (mounted as a Docker init script).

To connect manually:

```bash
# PostgreSQL
psql -h localhost -U rumshop -d rumshop
# Password: rumshop

# Redis
redis-cli -h localhost -p 6379
```

### AWS Deployment

`./scripts/deploy-aws.sh` creates everything via CloudFormation:

- **RDS PostgreSQL** (`db.t3.medium`, single-AZ, 20 GB gp3, private subnet, no public access)
- **ElastiCache Redis** (`cache.t3.small`, 1 node, private subnet, no public access)

The deploy script automatically:
1. Creates the CloudFormation stack (VPC, subnets, security groups, RDS, ElastiCache, EC2, ECS, Lambda, ALB, API Gateway, S3, CloudFront)
2. Builds and pushes Docker images to ECR
3. Deploys the frontend to S3 + CloudFront
4. Prints the RDS endpoint for you to create the Datadog monitoring user

After deployment, you need to create the Datadog monitoring user on RDS (see the DBM section below).

---

## FinOps Right-Sizing

Resources are intentionally oversized so Datadog Cloud Cost Management recommends downsizing:

| Resource | Deployed | Ideal | Monthly Savings |
|----------|----------|-------|-----------------|
| EC2 | t3.large (2 vCPU, 8 GB) ~$60/mo | t3.small ~$15/mo | ~$45/mo |
| ECS x3 tasks | 512 CPU / 1024 MB ~$54/mo | 256/512 ~$27/mo | ~$27/mo |
| RDS | db.t3.medium (2 vCPU, 4 GB) ~$50/mo | db.t3.micro ~$12/mo | ~$38/mo |
| ElastiCache | cache.t3.small (1.5 GB) ~$25/mo | cache.t3.micro ~$12/mo | ~$13/mo |
| **Total** | **~$189/mo** | **~$66/mo** | **~$123/mo (52%)** |

After a few days with data flowing, check **Infrastructure > Cloud Cost > Recommendations** in the Datadog UI. Datadog will flag each of these and suggest the smaller sizes.

---

## Datadog Instrumentation

### RUM (Frontend)

Uses `@datadog/browser-rum` (npm package) with RUM-to-APM trace correlation. All keys come from environment variables — nothing is hardcoded.

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

`allowedTracingUrls` injects `x-datadog-trace-id`, `x-datadog-parent-id`, `traceparent`, and `tracestate` headers on every request to the backend. This links the user's browser session to the backend APM traces end-to-end.

See [Connect RUM and Traces](https://docs.datadoghq.com/real_user_monitoring/platform/connect_rum_and_traces/) for details.

### Java APM (EC2)

The Datadog Agent is installed on the EC2 instance during boot (CloudFormation UserData). The Java app starts with:

```
java -javaagent:/opt/dd-java-agent.jar \
  -Ddd.service=kelvo-ecomm-order-service \
  -Ddd.env=production \
  -Ddd.profiling.enabled=true \
  -Ddd.logs.injection=true \
  -jar /opt/rumshop/order-service.jar
```

### Node.js APM (ECS Fargate)

Each ECS task has two containers:
1. **App container**: starts with `NODE_OPTIONS='--require=dd-trace/init' node server.js`
2. **Datadog Agent sidecar**: communicates via Unix Domain Socket (UDS) at `/var/run/datadog/apm.socket`

Logs are routed to Datadog via **Firelens** (AWS FireLens with fluent-bit).

### Python APM (Lambda — Remote Instrumentation)

Lambda functions are deployed **without** any Datadog layers or environment variables. After deployment, enable instrumentation from the Datadog UI:

1. Go to **APM > Service Setup > Serverless**
2. Click **Remotely instrument in Datadog > Open Serverless**
3. Click **+ Enable Region** and select your deployment region
4. Select the `rumshop-*` Lambda functions
5. Enable APM/Tracing and Logs, then click **Confirm**

Datadog will automatically inject the required layers and environment variables into the Lambda functions. No code changes needed.

### Docker Compose (local APM)

The `dd-agent` container uses UDS sockets (`DD_APM_RECEIVER_SOCKET=/var/run/datadog/apm.socket`). All backend services mount the shared `dd-sockets` Docker volume to send traces to the Agent.

---

## Datadog Database Monitoring (DBM)

DBM gives you visibility into query performance, slow queries, explain plans, active connections, and blocking queries — for both PostgreSQL and Redis.

### How it works

The Datadog **Agent** connects directly to the database and runs read-only queries to collect metrics and query samples. It does **not** go through your application — it's a separate monitoring connection.

```
┌─ Datadog Agent ────────────────────────────────────┐
│                                                     │
│  postgres.d/conf.yaml → connects to PostgreSQL     │
│    - Collects pg_stat_statements (query metrics)   │
│    - Runs EXPLAIN on sampled queries               │
│    - Monitors pg_stat_activity (active queries)    │
│    - Tracks locks, connections, replication lag     │
│                                                     │
│  redisdb.d/conf.yaml → connects to Redis           │
│    - Collects INFO stats (memory, clients, keys)   │
│    - Monitors SLOWLOG                               │
│    - Tracks command latency and throughput          │
│                                                     │
│  Sends all data to → app.datadoghq.com             │
└─────────────────────────────────────────────────────┘
```

### PostgreSQL DBM — Permissions Setup

The Agent needs a dedicated read-only user (`datadog`) with specific permissions. The script `infrastructure/postgres-init.sql` creates everything:

```sql
-- 1. Create the monitoring user
CREATE USER datadog WITH PASSWORD 'datadog';

-- 2. Grant pg_monitor role (required for DBM)
--    This gives read access to:
--    - pg_stat_statements  (query performance)
--    - pg_stat_activity    (active queries)
--    - pg_stat_database    (database-level stats)
--    - pg_locks            (lock monitoring)
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;

-- 3. Create a schema for Datadog explain plans
CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;
GRANT USAGE ON SCHEMA public TO datadog;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;

-- 4. Create the explain plan function (used by DBM to collect query plans)
CREATE OR REPLACE FUNCTION datadog.explain_statement(
    l_query TEXT, OUT explain JSON
) RETURNS SETOF JSON AS $$
DECLARE curs REFCURSOR; plan JSON;
BEGIN
    OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
    FETCH curs INTO plan; CLOSE curs;
    RETURN QUERY SELECT plan;
END;
$$ LANGUAGE 'plpgsql' RETURNS NULL ON NULL INPUT SECURITY DEFINER;
```

**Local setup**: This script runs automatically on first `docker-compose up`. It's mounted into the PostgreSQL container as `/docker-entrypoint-initdb.d/01-datadog.sql`.

**AWS setup (RDS)**: After `deploy-aws.sh` finishes, connect to the RDS instance from the EC2 host and run the script:

```bash
# SSH into the EC2 instance (get the IP from the deploy output)
ssh -i your-keypair.pem ec2-user@<EC2_PUBLIC_IP>

# Install psql
sudo dnf install -y postgresql16

# Run the init script against RDS
PGPASSWORD='<RDS_PASSWORD>' psql \
  -h <RDS_ENDPOINT> \
  -U rumshop \
  -d rumshop \
  -c "
CREATE USER datadog WITH PASSWORD 'datadog';
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;
CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;
GRANT USAGE ON SCHEMA public TO datadog;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;
CREATE OR REPLACE FUNCTION datadog.explain_statement(l_query TEXT, OUT explain JSON)
RETURNS SETOF JSON AS \\\$\\\$
DECLARE curs REFCURSOR; plan JSON;
BEGIN
  OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
  FETCH curs INTO plan; CLOSE curs;
  RETURN QUERY SELECT plan;
END;
\\\$\\\$ LANGUAGE 'plpgsql' RETURNS NULL ON NULL INPUT SECURITY DEFINER;
"
```

Replace `<RDS_ENDPOINT>` with the value from the deploy output (e.g. `rumshop-postgres.abc123.us-east-1.rds.amazonaws.com`) and `<RDS_PASSWORD>` with the password you set in `.env.aws`.

**Verify it works:**

```bash
PGPASSWORD='datadog' psql -h <RDS_ENDPOINT> -U datadog -d rumshop \
  -c "SELECT * FROM pg_stat_database LIMIT 1;" \
  && echo "PostgreSQL DBM connection OK" \
  || echo "Connection FAILED"
```

### Redis Monitoring — No Special Permissions Needed

Redis does not require a special user. The Agent connects directly and runs `INFO` and `SLOWLOG` commands.

**Local**: The `dd-agent` container auto-discovers the Redis container via Docker labels (Autodiscovery).

**AWS**: The Datadog Agent on EC2 connects to ElastiCache using the endpoint configured in `redisdb.d/conf.yaml` (set up automatically in EC2 UserData).

### Agent Configuration — How it's set up

**Local (Docker Compose)**:

The PostgreSQL and Redis containers have Autodiscovery labels in `docker-compose.yml`:

```yaml
# PostgreSQL container labels
labels:
  com.datadoghq.ad.check_names: '["postgres"]'
  com.datadoghq.ad.init_configs: '[{}]'
  com.datadoghq.ad.instances: '[{
    "host":"%%host%%",
    "port":5432,
    "username":"datadog",
    "password":"datadog",
    "dbname":"rumshop",
    "dbm":true
  }]'
  com.datadoghq.ad.logs: '[{"source":"postgresql","service":"kelvo-ecomm-postgres"}]'

# Redis container labels
labels:
  com.datadoghq.ad.check_names: '["redisdb"]'
  com.datadoghq.ad.init_configs: '[{}]'
  com.datadoghq.ad.instances: '[{"host":"%%host%%","port":6379}]'
  com.datadoghq.ad.logs: '[{"source":"redis","service":"kelvo-ecomm-redis"}]'
```

The Datadog Agent detects these labels automatically and starts collecting DBM data. No manual config files needed.

**AWS (EC2 UserData)**:

The CloudFormation template writes Agent config files during EC2 boot:

```yaml
# /etc/datadog-agent/conf.d/postgres.d/conf.yaml
init_config:
instances:
  - host: <RDS_ENDPOINT>
    port: 5432
    username: datadog
    password: datadog
    dbname: rumshop
    dbm: true
    collect_activity_metrics: true
    collect_database_size_metrics: true
    tags:
      - env:production
      - service:kelvo-ecomm-postgres

# /etc/datadog-agent/conf.d/redisdb.d/conf.yaml
init_config:
instances:
  - host: <ELASTICACHE_ENDPOINT>
    port: 6379
    tags:
      - env:production
      - service:kelvo-ecomm-redis
```

The EC2 instance can reach both RDS and ElastiCache because the security groups allow it (see the Network Architecture section above).

### What you see in Datadog after setup

Once everything is running, go to:

- **[DBM > Query Metrics](https://app.datadoghq.com/databases/queries)** — See top queries by execution time, rows returned, and error rate
- **[DBM > Query Samples](https://app.datadoghq.com/databases/samples)** — Individual query executions with EXPLAIN plans
- **[DBM > Database Hosts](https://app.datadoghq.com/databases)** — Connection count, database size, replication lag
- **[Infrastructure > Redis](https://app.datadoghq.com/dash/integration/15/redis-overview)** — Memory usage, hit/miss rates, command latency, connected clients

DBM data also appears correlated with APM traces: when you view a trace that includes a database query, you can click through to see the explain plan and query performance history.

Docs:
- [PostgreSQL DBM Setup](https://docs.datadoghq.com/database_monitoring/setup_postgres/selfhosted/)
- [PostgreSQL DBM on RDS](https://docs.datadoghq.com/database_monitoring/setup_postgres/rds/)
- [Redis Integration](https://docs.datadoghq.com/integrations/redisdb/)

---

## Quick Start

There are only two ways to run this app: **locally with Docker** or **deployed to AWS**. No local Java, Node, or Python installation needed for either.

### Option 1: Run locally with Docker

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running.

```bash
# 1. Copy the environment template
cp .env.local .env

# 2. Open .env and set your Datadog values:
#    DD_API_KEY                  → from https://app.datadoghq.com/organization-settings/api-keys
#    REACT_APP_DD_APPLICATION_ID → from your RUM app page
#    REACT_APP_DD_CLIENT_TOKEN   → from your RUM app page

# 3. Start everything (databases, backends, frontend)
./scripts/run-local.sh

# 4. Other commands:
./scripts/run-local.sh stop        # Stop all containers
./scripts/run-local.sh status      # Show container status
./scripts/run-local.sh logs        # Tail all logs
./scripts/run-local.sh logs frontend  # Tail logs for one service
```

| What | URL |
|------|-----|
| Frontend | http://localhost:3000 |
| Swagger UI (API docs) | http://localhost:8888 |
| Order Service (Java) | http://localhost:8080/api/products |
| Cart Service | http://localhost:3001/health |
| Auth Service | http://localhost:3002/health |
| Payment Service | http://localhost:3003/health |
| Search (Python) | http://localhost:3004/api/search?q=shirt |
| Recommendations | http://localhost:3005/api/recommendations?productId=1 |
| PostgreSQL | `localhost:5432` (user: `rumshop`, password: `rumshop`) |
| Redis | `localhost:6379` |

### Option 2: Deploy to AWS

Prerequisites: [AWS CLI](https://aws.amazon.com/cli/) installed and configured (`aws configure`).

```bash
# 1. Copy and fill in the AWS environment file
cp .env.aws .env
# Edit .env: set ALL <YOUR_...> values (see "Environment Variables" below)

# 2. Deploy (takes ~15-20 minutes the first time)
./scripts/deploy-aws.sh

# 3. After deploy: create the Datadog DBM user on RDS
#    (the deploy script prints the exact command to run)

# 4. Enable Lambda Remote Instrumentation in the Datadog UI
#    (see "Python APM" section above)

# 5. When you're done, tear everything down:
./scripts/teardown-aws.sh
```

---

## Environment Variables

### How it works

There are **three** env files in the repo. All of them are **templates** with placeholder values. None of them contain real secrets.

```
.env.local      ← template for local development (Docker Compose)
.env.aws        ← template for AWS deployment
.env.example    ← minimal quick reference
```

To use them:

```bash
# For local development:
cp .env.local .env

# For AWS deployment:
cp .env.aws .env
```

Then open `.env` and replace all `<YOUR_...>` placeholders with your real values. The `.env` file is **git-ignored** — your secrets never get committed.

Docker Compose, `run-local.sh`, and `deploy-aws.sh` all read from `.env` in the project root automatically.

### Which file has what

| File | Git tracked? | Contains secrets? | Used by |
|------|:------------:|:-----------------:|---------|
| `.env.local` | Yes | No (placeholders only) | Template — copy to `.env` for local dev |
| `.env.aws` | Yes | No (placeholders only) | Template — copy to `.env` for AWS deploy |
| `.env.example` | Yes | No (placeholders only) | Minimal quick reference |
| `.env` | **No** (git-ignored) | **Yes** (your real values) | Docker Compose, scripts, builds |

### Variables you need to fill in

**Datadog (required for both local and AWS):**

| Variable | Where to get it |
|----------|-----------------|
| `DD_API_KEY` | [Organization Settings > API Keys](https://app.datadoghq.com/organization-settings/api-keys) |
| `DD_APP_KEY` | [Organization Settings > Application Keys](https://app.datadoghq.com/organization-settings/application-keys) |
| `REACT_APP_DD_APPLICATION_ID` | [Digital Experience > RUM > your app](https://app.datadoghq.com/rum/application/create) |
| `REACT_APP_DD_CLIENT_TOKEN` | Same page as the Application ID above |
| `DD_SITE` | Usually `datadoghq.com`. Other options: `datadoghq.eu`, `us3.datadoghq.com`, `us5.datadoghq.com`, `ap1.datadoghq.com` |

The RUM values use the `REACT_APP_DD_` prefix because React requires it to inject environment variables at build time. The same values are also read by Docker Compose and deploy scripts for the Datadog Agent config.

**AWS-only (only needed in `.env.aws`):**

| Variable | What it is |
|----------|------------|
| `AWS_REGION` | AWS region to deploy to (e.g. `us-east-1`) |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID (find it in the AWS console top-right menu) |
| `EC2_KEY_PAIR_NAME` | Name of an existing EC2 key pair for SSH access ([create one here](https://console.aws.amazon.com/ec2/home#KeyPairs:)) |
| `JWT_SECRET` | Any random string for signing auth tokens. Generate one: `openssl rand -hex 32` |
| `RDS_PASSWORD` | Password for the `rumshop` PostgreSQL user on RDS. Minimum 8 characters. |

**No API keys, application keys, or tokens are hardcoded anywhere in the code.** All sensitive values are loaded from environment variables at build/runtime.

---

## API Reference

Full OpenAPI 3.0 spec: [`docs/openapi.yaml`](docs/openapi.yaml) — Swagger UI at http://localhost:8888 when running Docker Compose.

Curl examples: [`docs/api-examples.sh`](docs/api-examples.sh)

### Orders (EC2 Java) — `/api/products`, `/api/orders`

`GET /api/products` · `GET /api/products/{id}` · `GET /api/products/search?q=` · `POST /api/products` · `PUT /api/products/{id}/stock` · `POST /api/orders` · `GET /api/orders/{id}` · `PUT /api/orders/{id}/status`

### Cart (ECS Node.js) — `/api/cart`

`POST /api/cart/add` · `GET /api/cart/{sessionId}` · `PUT /api/cart/update` · `DELETE /api/cart/{sessionId}/item/{productId}` · `DELETE /api/cart/{sessionId}` · `POST /api/cart/apply-coupon` · `POST /api/cart/remove-coupon`

### Auth (ECS Node.js) — `/api/auth`

`POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/profile`

### Payment (ECS Node.js) — `/api/payment`

`POST /api/payment/create-intent` · `POST /api/payment/confirm` · `POST /api/payment/webhook` · `POST /api/payment/validate-coupon`

### Search (Lambda Python) — `/api/search`

`GET /api/search?q=&category=&minPrice=&maxPrice=&sort=`

### Recommendations (Lambda Python) — `/api/recommendations`

`GET /api/recommendations?productId={id}&limit=4`

### Notifications (Lambda Python) — `/api/notifications`

`POST /api/notifications/order-confirmation` · `POST /api/notifications/shipping-update`

---

## Coupon Codes (Demo)

Test discount coupons in the cart drawer:

| Code | Effect |
|------|--------|
| `KELVO10` | 10% off your order (works) |
| `KELVO25` | 25% off your order (works) |
| `WELCOME5` | 5% welcome discount (works) |
| `FRETE` | Free shipping (works) |
| `BLACKFRIDAY` | Triggers a backend error — use this to demo Datadog error tracking and RUM-to-APM trace correlation |

The coupon flow: **Frontend** -> **Cart Service** (`/api/cart/apply-coupon`) -> **Payment Service** (`/api/payment/validate-coupon`).
`BLACKFRIDAY` intentionally causes a 500 error in the Payment Service (simulated Redis timeout), which propagates back through the Cart Service with detailed error tags in Datadog APM spans.

---

## Error Demos (Datadog Trace Correlation)

### Smart Watch Pro — Cart Limit Error

Add the product **Smart Watch Pro** (product #3) to your cart. The first 2 units succeed. When you try to add a 3rd unit, the backend returns a generic `"Error adding item"` message. The real error detail (`inventory sync timeout — warehouse-api.internal:8443 unreachable`) only appears in backend logs and Datadog APM traces — never exposed to the user. This demonstrates RUM error capture correlating with backend APM spans.

### BLACKFRIDAY Coupon — Cross-Service Error

Enter the coupon code `BLACKFRIDAY` in the cart drawer. The Cart Service calls the Payment Service to validate, which responds with a 500 error (simulated `coupon-store.internal:6380` Redis timeout). The user sees `"Could not apply coupon code"` while the full error chain is visible in Datadog APM traces across both services.

---

## Demo Credentials

Email: `demo@kelvo-ecomm.com`
Password: `password123`
