# RUM Shop - E-Commerce Application

Full-stack e-commerce app with polyglot microservices on AWS, fully instrumented with **Datadog RUM**, **APM**, and **FinOps** (intentionally oversized infra for right-sizing recommendations).

## Architecture

```
                        ┌─────────────────────┐
                        │   CloudFront (CDN)   │
                        │   S3 Static Hosting  │
                        └─────────┬───────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   React Frontend (SPA)     │
                    │   Datadog RUM + Replay     │
                    └──┬──────┬──────┬──────┬───┘
                       │      │      │      │
          ┌────────────▼──┐   │      │   ┌──▼────────────┐
          │   ALB (HTTP)  │   │      │   │  API Gateway   │
          └──┬─────┬──────┘   │      │   └──┬──────┬─────┘
             │     │          │      │      │      │
     ┌───────▼┐ ┌──▼──────┐  │      │  ┌───▼──┐ ┌─▼─────────┐
     │  EC2   │ │ ECS     │  │      │  │Lambda│ │  Lambda    │
     │m5.xlarge│ │ Fargate │  │      │  │Python│ │  Python    │
     │ Java   │ │ Node.js │  │      │  └──────┘ └───────────┘
     │ Order  │ │Cart/Auth│  │      │
     │Service │ │/Payment │  │      │  Search, Recommendations,
     └────────┘ └─────────┘  │      │  Notifications
                             │      │
                    ┌────────▼──────▼────────┐
                    │    Datadog Agent        │
                    │ APM · Metrics · Logs    │
                    │ FinOps · Profiling      │
                    └────────────────────────┘
```

## Services

| Service | Language | AWS Runtime | Port | Datadog Service Name | Why this runtime |
|---------|----------|-------------|------|---------------------|------------------|
| **Order Service** | Java 17 (Spring Boot) | **EC2** (m5.xlarge) | 8080 | `rum-shop-order-service` | Stateful, JVM warm-up, DB connections |
| **Cart Service** | Node.js 20 | **ECS Fargate** | 3001 | `rum-shop-cart` | Containerized, auto-scaling, fast cold start |
| **Auth Service** | Node.js 20 | **ECS Fargate** | 3002 | `rum-shop-auth` | Containerized, JWT handling needs persistence |
| **Payment Service** | Node.js 20 | **ECS Fargate** | 3003 | `rum-shop-payment` | Containerized, payment sessions need state |
| **Search** | Python 3.11 | **Lambda** | 3004 | `rum-shop-search` | Stateless, event-driven, short-lived |
| **Recommendations** | Python 3.11 | **Lambda** | 3005 | `rum-shop-recommendations` | Stateless, event-driven, short-lived |
| **Notifications** | Python 3.11 | **Lambda** | 3006 | `rum-shop-notifications` | Stateless, event-driven, fire-and-forget |
| **Frontend** | React + TypeScript | **S3 + CloudFront** | 3000 | `rum-shop-frontend` | Static SPA, CDN-optimized |

## FinOps / Right-Sizing Demo

Resources are **intentionally oversized** so Datadog Cloud Cost Management detects the waste and recommends downsizing.

| Resource | Deployed Size | Actual Need | Monthly Cost | Ideal Cost | Savings |
|----------|--------------|-------------|-------------|------------|---------|
| EC2 (Order Service) | **m5.xlarge** (4 vCPU, 16 GB) | t3.small (2 vCPU, 2 GB) | ~$140 | ~$15 | **~$125** |
| ECS Cart | **1024 CPU / 2048 MB** | 256 CPU / 512 MB | ~$36 | ~$9 | **~$27** |
| ECS Auth | **1024 CPU / 2048 MB** | 256 CPU / 512 MB | ~$36 | ~$9 | **~$27** |
| ECS Payment | **1024 CPU / 2048 MB** | 256 CPU / 512 MB | ~$36 | ~$9 | **~$27** |
| **Total** | | | **~$248** | **~$42** | **~$206 (83%)** |

After Datadog detects the pattern (usually 1-2 weeks), you'll see right-sizing recommendations in **Infrastructure > Cloud Cost > Recommendations**.

## Datadog Instrumentation

### Frontend — RUM (Real User Monitoring)
- `@datadog/browser-rum` with Session Replay (100% sample rate)
- `@datadog/browser-logs` for browser log collection
- Tracks: page views, user interactions, resources, long tasks, errors
- Trace propagation to backends via `allowedTracingUrls` (datadog + tracecontext)

### Java — APM on EC2 (dd-java-agent)
- Datadog Agent installed on EC2 via install script
- `dd-java-agent.jar` as JVM `-javaagent` flag
- `@Trace` annotations on service methods
- Profiling enabled (`dd.profiling.enabled=true`)
- Log injection for correlated logs

### Node.js — APM on ECS Fargate (dd-trace/init + UDS sockets)
- **Dockerfile pattern**: `NODE_OPTIONS='--require=dd-trace/init' node server.js`
- **Datadog Agent sidecar** in each ECS task definition
- **UDS (Unix Domain Sockets)**: Agent and app share `/var/run/datadog` volume
- App sets `DD_TRACE_AGENT_URL=unix:///var/run/datadog/apm.socket`
- **Firelens log router** (aws-for-fluent-bit) forwards logs to Datadog
- Custom spans via `tracer.trace()` for business logic

### Python — APM on Lambda (Datadog Remote Instrumentation)
- **No Datadog layers or env vars in CloudFormation** — Lambda functions are deployed clean
- Instrumented via **Datadog Remote Instrumentation** from the Datadog UI
- After deploying, go to: **APM > Service Setup > Serverless > Remote Instrumentation**
  1. Click "Open Serverless" under "Remotely instrument in Datadog"
  2. Click "+ Enable Region" and select your region
  3. Click "Select Functions" and choose the `rumshop-*` functions
  4. Configure APM/Tracing and Logs, then Confirm
- The Remote Instrumenter (CloudTrail + EventBridge + Lambda) automatically injects Datadog layers and env vars

### Docker Compose — Local (UDS sockets)
- Datadog Agent runs with `DD_APM_RECEIVER_SOCKET=/var/run/datadog/apm.socket`
- All services mount the shared `dd-sockets` volume at `/var/run/datadog`
- Same UDS pattern as production ECS Fargate

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (frontend dev)
- Java 17+ (order service dev)
- Python 3.11+ (lambda dev)
- AWS CLI v2 (for AWS deploy)

### Option 1: Docker Compose (easiest)

```bash
# Copy env file and set your Datadog keys
cp .env.local .env
# Edit .env → set DD_API_KEY, DD_RUM_APPLICATION_ID, DD_RUM_CLIENT_TOKEN

# Start everything
docker-compose up -d

# Verify
docker-compose ps
curl http://localhost:8080/api/products
curl http://localhost:3001/health
```

Frontend: http://localhost:3000

### Option 2: Run locally (manual)

```bash
# Install Python deps
cd backend/python-lambdas && pip install -r requirements.txt flask flask-cors && cd ../..

# Install Node.js deps
cd backend/nodejs-lambdas && npm install && cd ../..

# Install frontend deps
cd frontend && npm install && cd ..

# Start all backend services
./scripts/run-local.sh

# Start frontend (separate terminal)
cd frontend && npm start
```

### Option 3: Deploy to AWS

```bash
# 1. Configure AWS CLI
aws configure
# Or set AWS_PROFILE in .env.aws

# 2. Fill in .env.aws with ALL your values
cp .env.aws.example .env.aws  # or edit .env.aws directly
# Set: AWS_REGION, AWS_ACCOUNT_ID, DD_API_KEY, DD_APP_KEY,
#      DD_RUM_APPLICATION_ID, DD_RUM_CLIENT_TOKEN, EC2_KEY_PAIR_NAME, JWT_SECRET

# 3. Deploy everything
chmod +x scripts/*.sh
./scripts/deploy-aws.sh

# 4. When done with the lab, teardown to stop billing
./scripts/teardown-aws.sh
```

## Environment Files

| File | Purpose | When to use |
|------|---------|-------------|
| `.env.local` | Local development with Docker Compose or run-local.sh | `cp .env.local .env` for docker-compose |
| `.env.aws` | AWS deployment configuration | Edit before `./scripts/deploy-aws.sh` |

### Required Datadog Values

| Variable | Where to find it |
|----------|-----------------|
| `DD_API_KEY` | [Organization Settings > API Keys](https://app.datadoghq.com/organization-settings/api-keys) |
| `DD_APP_KEY` | [Organization Settings > Application Keys](https://app.datadoghq.com/organization-settings/application-keys) |
| `DD_RUM_APPLICATION_ID` | [RUM > Application > Create](https://app.datadoghq.com/rum/application/create) |
| `DD_RUM_CLIENT_TOKEN` | Same page as RUM Application ID |
| `DD_SITE` | Your Datadog site: `datadoghq.com` (US1), `datadoghq.eu` (EU), `us3.datadoghq.com` (US3), `us5.datadoghq.com` (US5), `ap1.datadoghq.com` (AP1) |

## Project Structure

```
RUM-App/
├── frontend/                              # React SPA (S3 + CloudFront)
│   ├── public/images/products/            # 12 SVG product images
│   ├── src/
│   │   ├── components/                    # Header, Footer, ProductCard, CartDrawer, SearchResults
│   │   ├── pages/                         # Home, Products, ProductDetail, Checkout, Login, OrderConfirmation
│   │   ├── context/                       # CartContext, AuthContext
│   │   ├── services/api.ts                # API client (all backends)
│   │   ├── data/mockProducts.ts           # Offline fallback data
│   │   └── styles/global.css              # Theme and layout
│   └── Dockerfile                         # nginx production build
│
├── backend/
│   ├── java-order-service/                # Spring Boot (EC2 VM)
│   │   ├── src/main/java/com/rumshop/orders/
│   │   │   ├── controller/                # ProductController, OrderController
│   │   │   ├── service/                   # ProductService, OrderService (with @Trace)
│   │   │   ├── model/                     # Product, Order, OrderItem, OrderStatus
│   │   │   ├── repository/                # JPA repositories
│   │   │   ├── config/                    # DataSeeder (12 products), CorsConfig
│   │   │   ├── dto/                       # Request DTOs
│   │   │   └── exception/                 # GlobalExceptionHandler
│   │   └── Dockerfile                     # Multi-stage build + dd-java-agent
│   │
│   ├── nodejs-lambdas/                    # Node.js (ECS Fargate)
│   │   ├── cart/handler.js                # Cart CRUD + totals
│   │   ├── auth/handler.js                # Register, Login (JWT), Profile
│   │   ├── payment/handler.js             # Mock Stripe (intent, confirm, webhook)
│   │   ├── shared/                        # tracer.js, responses.js, mockDb.js
│   │   └── Dockerfile.{cart,auth,payment} # Per-service Docker builds
│   │
│   └── python-lambdas/                    # Python (Lambda)
│       ├── search/handler.py              # Full-text search + filters
│       ├── recommendations/handler.py     # Similar products by category
│       ├── notifications/handler.py       # Order confirmation + shipping emails
│       ├── shared/utils.py                # Response helpers, product data
│       └── Dockerfile.{search,...}        # Per-service Docker builds
│
├── infrastructure/
│   └── aws-architecture.yaml              # CloudFormation (VPC, EC2, ECS, Lambda, S3, CF, ALB, API GW)
│
├── scripts/
│   ├── deploy-aws.sh                      # Full AWS deployment (CFN + ECR + ECS + Lambda + S3)
│   ├── run-local.sh                       # Start all services locally
│   └── teardown-aws.sh                    # Destroy all AWS resources
│
├── docker-compose.yml                     # Local dev (mirrors AWS architecture)
├── .env.local                             # Local env template
├── .env.aws                               # AWS deploy env template
└── .gitignore
```

## API Endpoints

### Order Service (EC2 - Java)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all products (optional `?category=`) |
| GET | `/api/products/{id}` | Get product by ID |
| GET | `/api/products/search?q=` | Search products |
| POST | `/api/products` | Create product |
| PUT | `/api/products/{id}/stock` | Update stock |
| POST | `/api/orders` | Create order |
| GET | `/api/orders/{id}` | Get order |
| GET | `/api/orders/customer/{email}` | Orders by customer |
| PUT | `/api/orders/{id}/status` | Update order status |

### Cart Service (ECS Fargate - Node.js)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cart/add` | Add item to cart |
| GET | `/api/cart/{sessionId}` | Get cart |
| PUT | `/api/cart/update` | Update item quantity |
| DELETE | `/api/cart/{sessionId}/item/{productId}` | Remove item |
| DELETE | `/api/cart/{sessionId}` | Clear cart |

### Auth Service (ECS Fargate - Node.js)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/profile` | Get profile (needs Bearer token) |

### Payment Service (ECS Fargate - Node.js)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/payment/create-intent` | Create payment intent |
| POST | `/api/payment/confirm` | Confirm payment |
| POST | `/api/payment/webhook` | Webhook handler |

### Search (Lambda - Python)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q=&category=&minPrice=&maxPrice=&sort=` | Search products |

### Recommendations (Lambda - Python)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/recommendations?productId={id}&limit=4` | Get recommendations |

### Notifications (Lambda - Python)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notifications/order-confirmation` | Send order confirmation |
| POST | `/api/notifications/shipping-update` | Send shipping update |

## Demo Credentials

- **Email**: `demo@rumshop.com`
- **Password**: `password123`

## Products (12 items, 4 categories)

| Category | Products |
|----------|----------|
| Electronics | Wireless Headphones ($299.99), Laptop 15" ($1,299.99), Smart Watch ($399.99), 4K Camera ($249.99) |
| Clothing | Cotton T-Shirt ($39.99), Crossbody Bag ($89.99), Running Shoes ($129.99), Denim Jacket ($79.99) |
| Home & Kitchen | Robot Vacuum ($449.99), Cookware Set ($199.99) |
| Sports | Yoga Mat ($49.99), Bike Helmet ($69.99) |
