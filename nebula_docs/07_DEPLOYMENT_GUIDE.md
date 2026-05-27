# Nebula Cluster — Deployment Guide

## 1. Deployment Modes

Nebula Cluster can run in multiple modes.

### Local Development

Use Docker Compose.

### Single VPS Production

Run API, dashboard, PostgreSQL, Redis, and reverse proxy on one VPS.

### Hybrid Production

Run master services on one reliable server and workers across many providers/accounts.

---

## 2. Local Development Setup

Recommended services:

```text
postgres
redis
api
dashboard
worker
```

Example Docker Compose structure:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: nebula
      POSTGRES_PASSWORD: nebula
      POSTGRES_DB: nebula
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build: ./apps/api
    environment:
      DATABASE_URL: postgresql://nebula:nebula@postgres:5432/nebula
      REDIS_URL: redis://redis:6379
      JWT_SECRET: change_me
    ports:
      - "4000:4000"
    depends_on:
      - postgres
      - redis

  dashboard:
    build: ./apps/dashboard
    ports:
      - "3000:3000"
    depends_on:
      - api

  worker:
    build: ./apps/worker
    environment:
      NEBULA_MASTER_URL: http://api:4000
      NEBULA_WORKER_TOKEN: dev_worker_token
    depends_on:
      - api
```

---

## 3. Environment Variables

### API

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
API_BASE_URL=https://api.example.com
DASHBOARD_URL=https://nebula.example.com
ENCRYPTION_KEY=...
```

### Dashboard

```bash
VITE_API_URL=https://api.example.com
VITE_WS_URL=https://api.example.com
```

### Worker

```bash
NEBULA_MASTER_URL=https://api.example.com
NEBULA_WORKER_TOKEN=...
NEBULA_PROVIDER=oracle
NEBULA_PROVIDER_ACCOUNT_ID=acct_1
NEBULA_PROJECT_ID=project_1
NEBULA_WORKER_POOL_ID=pool_1
NEBULA_MAX_CONCURRENT_JOBS=2
```

---

## 4. Single VPS Production

Recommended stack:

- Ubuntu VPS
- Docker Engine
- Docker Compose
- Caddy or Nginx
- PostgreSQL volume
- Redis volume
- Daily database backups

Recommended minimum VPS:

```text
2 CPU cores
4 GB RAM
40 GB disk
```

For small MVP testing, 1 CPU / 2 GB RAM can work, but Redis/PostgreSQL and logs may become tight.

---

## 5. Reverse Proxy

Use Caddy for simple HTTPS.

Example Caddyfile:

```text
nebula.example.com {
  reverse_proxy dashboard:3000
}

api.nebula.example.com {
  reverse_proxy api:4000
}
```

---

## 6. Worker Deployment

### Docker Worker

```bash
docker run -d \
  --name nebula-worker \
  --restart unless-stopped \
  -e NEBULA_MASTER_URL=https://api.nebula.example.com \
  -e NEBULA_WORKER_TOKEN=worker_token_xxx \
  -e NEBULA_PROVIDER=docker-vps \
  -e NEBULA_PROVIDER_ACCOUNT_ID=acct_1 \
  -e NEBULA_PROJECT_ID=project_1 \
  nebula/worker:latest
```

### Render/Railway Worker

Deploy the worker app as a background service and set environment variables in the provider dashboard.

### Local Worker

```bash
npm install
npm run worker:start
```

---

## 7. Backups

Back up:

- PostgreSQL database
- Encryption keys
- Object storage artifacts
- Environment files

Recommended backup frequency:

```text
Database: daily
Secrets/encryption config: after every change
Artifacts: depends on retention policy
```

---

## 8. Health Checks

Add endpoints:

```http
GET /health
GET /ready
```

`/health` checks API process.

`/ready` checks:

- PostgreSQL connectivity
- Redis connectivity
- Queue availability

---

## 9. Scaling Path

### Stage 1

Single API + dashboard + PostgreSQL + Redis.

### Stage 2

Move PostgreSQL to managed DB.

### Stage 3

Move Redis to managed Redis.

### Stage 4

Separate scheduler and websocket service.

### Stage 5

Multiple API replicas behind load balancer.

---

## 10. Production Checklist

Before production:

- HTTPS enabled
- JWT secret generated securely
- Encryption key generated securely
- API keys hashed
- Worker tokens rotated
- Database backups configured
- Redis persistence configured or managed Redis used
- Log retention configured
- Rate limits enabled
- CORS allowlist configured
- Admin emergency controls available
