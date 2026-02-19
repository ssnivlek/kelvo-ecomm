# Kelvo E-Comm Frontend

A modern React e-commerce frontend for Kelvo E-Comm with Datadog RUM integration.

## Setup

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env` and configure your Datadog and API URLs:

```bash
cp .env.example .env
```

## Run

```bash
npm start
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Features

- **Datadog RUM**: Session replay, user interaction tracking, error forwarding
- **Product catalog**: Browse products from Java API with mock fallback
- **Shopping cart**: Add/remove items, syncs with Cart Lambda (local fallback when API down)
- **Search**: Full-text search via Search Lambda with filters
- **Checkout**: Order → Payment → Notification flow across Java, Node.js, and Python services
- **Auth**: Login/Register with Auth Lambda, JWT in localStorage

## API Endpoints

| Service | Default URL |
|---------|-------------|
| Orders (Java) | http://localhost:8080 |
| Cart (Node.js) | http://localhost:3001 |
| Auth (Node.js) | http://localhost:3002 |
| Payment (Node.js) | http://localhost:3003 |
| Search (Python) | http://localhost:3004 |
| Recommendations (Python) | http://localhost:3005 |
| Notifications (Python) | http://localhost:3006 |

The app works with mock data when backend APIs are not running.
