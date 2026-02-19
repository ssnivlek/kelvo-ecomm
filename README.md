# Kelvo-Ecomm

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
| Orders | Java 17 (Spring Boot) | EC2 `t3.large` | 8080 | `rum-shop-order-service` |
| Cart | Node.js 20 | ECS Fargate | 3001 | `rum-shop-cart` |
| Auth | Node.js 20 | ECS Fargate | 3002 | `rum-shop-auth` |
| Payment | Node.js 20 | ECS Fargate | 3003 | `rum-shop-payment` |
| Search | Python 3.11 | Lambda | 3004 | `rum-shop-search` |
| Recommendations | Python 3.11 | Lambda | 3005 | `rum-shop-recommendations` |
| Notifications | Python 3.11 | Lambda | 3006 | `rum-shop-notifications` |
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

### Option 1: Docker Compose (Recommended for local development)

Everything starts automatically. Just run:

```bash
cp .env.local .env
# Edit .env with your Datadog keys (see "Environment Variables" section below)

docker-compose up -d
```

This brings up:
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

### Option 2: Run services locally without Docker

If you prefer to run the backend processes directly (not in Docker), you still need PostgreSQL and Redis running. You can either:

**a) Use Docker just for the databases:**

```bash
docker run -d --name rumshop-postgres \
  -e POSTGRES_DB=rumshop \
  -e POSTGRES_USER=rumshop \
  -e POSTGRES_PASSWORD=rumshop \
  -p 5432:5432 \
  -v $(pwd)/infrastructure/postgres-init.sql:/docker-entrypoint-initdb.d/01-datadog.sql:ro \
  postgres:16-alpine

docker run -d --name rumshop-redis \
  -p 6379:6379 \
  redis:7-alpine redis-server --appendonly yes
```

**b) Use locally installed PostgreSQL and Redis:**

```bash
# Create the database and user
createdb rumshop
psql -d rumshop -c "CREATE USER rumshop WITH PASSWORD 'rumshop'; GRANT ALL ON DATABASE rumshop TO rumshop;"
psql -d rumshop -f infrastructure/postgres-init.sql

# Start Redis (brew install redis)
redis-server --daemonize yes
```

Then start the backend services:

```bash
# Install dependencies
cd backend/python-lambdas && pip install -r requirements.txt flask flask-cors && cd ../..
cd backend/nodejs-lambdas && npm install && cd ../..
cd frontend && npm install && cd ..

# Start all backends (they connect to localhost:5432 and localhost:6379)
./scripts/run-local.sh

# In another terminal, start the frontend
cd frontend && npm start
```

### Option 3: AWS Deployment

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
  -Ddd.service=rum-shop-order-service \
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
  com.datadoghq.ad.logs: '[{"source":"postgresql","service":"rum-shop-postgres"}]'

# Redis container labels
labels:
  com.datadoghq.ad.check_names: '["redisdb"]'
  com.datadoghq.ad.init_configs: '[{}]'
  com.datadoghq.ad.instances: '[{"host":"%%host%%","port":6379}]'
  com.datadoghq.ad.logs: '[{"source":"redis","service":"rum-shop-redis"}]'
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
      - service:rum-shop-postgres

# /etc/datadog-agent/conf.d/redisdb.d/conf.yaml
init_config:
instances:
  - host: <ELASTICACHE_ENDPOINT>
    port: 6379
    tags:
      - env:production
      - service:rum-shop-redis
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

### Docker Compose (everything in one command)

```bash
# 1. Copy the environment template
cp .env.local .env

# 2. Open .env and set your Datadog values:
#    DD_API_KEY          → from https://app.datadoghq.com/organization-settings/api-keys
#    DD_RUM_APPLICATION_ID → from your RUM app page
#    DD_RUM_CLIENT_TOKEN → from your RUM app page

# 3. Start everything
docker-compose up -d

# 4. Wait ~30 seconds for databases and services to start
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

### Deploy to AWS

```bash
# 1. Make sure AWS CLI is configured
aws configure
# Set your region, access key, secret key

# 2. Copy and fill in the AWS environment file
cp .env.aws .env
# Set all required values (see the "Environment Variables" section)

# 3. Deploy (takes ~15-20 minutes the first time)
./scripts/deploy-aws.sh

# 4. After deploy: create the Datadog DBM user on RDS
#    (the deploy script prints the exact command to run)

# 5. Enable Lambda Remote Instrumentation in the Datadog UI
#    (see "Python APM" section above)

# 6. When you're done, tear everything down:
./scripts/teardown-aws.sh
```

---

## Environment Variables

| File | Usage |
|------|-------|
| `.env.local` | Local development (Docker Compose or `run-local.sh`) |
| `.env.aws` | AWS deployment via `deploy-aws.sh` |
| `frontend/.env.example` | React environment variable reference |

### Required Datadog Values

| Variable | Where to get it |
|----------|-----------------|
| `DD_API_KEY` | [Organization Settings > API Keys](https://app.datadoghq.com/organization-settings/api-keys) |
| `DD_APP_KEY` | [Organization Settings > Application Keys](https://app.datadoghq.com/organization-settings/application-keys) |
| `DD_RUM_APPLICATION_ID` | [Digital Experience > RUM > your app](https://app.datadoghq.com/rum/application/create) |
| `DD_RUM_CLIENT_TOKEN` | Same page as Application ID |
| `DD_SITE` | Usually `datadoghq.com`. Other options: `datadoghq.eu`, `us3.datadoghq.com`, `us5.datadoghq.com`, `ap1.datadoghq.com` |

### AWS-Specific Values

| Variable | What it is |
|----------|------------|
| `AWS_REGION` | AWS region to deploy to (e.g. `us-east-1`) |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |
| `EC2_KEY_PAIR_NAME` | Name of an existing EC2 key pair for SSH |
| `JWT_SECRET` | Any random string (used to sign auth tokens). Generate one: `openssl rand -hex 32` |
| `RDS_PASSWORD` | Password for the `rumshop` PostgreSQL user on RDS. Choose something strong. |

**No API keys, application keys, or tokens are hardcoded anywhere.** All sensitive values are loaded from environment variables at build/runtime.

---

## API Reference

Full OpenAPI 3.0 spec: [`docs/openapi.yaml`](docs/openapi.yaml) — Swagger UI at http://localhost:8888 when running Docker Compose.

Curl examples: [`docs/api-examples.sh`](docs/api-examples.sh)

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

---

## Demo Credentials

Email: `demo@rumshop.com`
Password: `password123`
