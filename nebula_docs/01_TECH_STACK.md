# Nebula Cluster — Recommended Tech Stack

## 1. Stack Summary

Nebula Cluster should use a simple, production-friendly stack that is easy to deploy, debug, and extend.

| Layer | Recommended Choice | Reason |
|---|---|---|
| Frontend | React + Vite | Fast dashboard development |
| Styling | TailwindCSS | Clean UI, easy responsive design |
| UI Components | shadcn/ui | Fast admin dashboard UI |
| Charts | Recharts | Worker metrics and queue graphs |
| Realtime Client | Socket.IO Client | Live logs, metrics, worker status |
| API Server | Node.js + Express.js | Simple REST API and middleware support |
| Realtime Server | Socket.IO | Bidirectional events between dashboard, master, and workers |
| Queue | Redis + BullMQ | Job queue, retries, priority, delayed jobs |
| Database | PostgreSQL | Durable relational data for users, workers, jobs, logs, metrics |
| ORM | Prisma | Type-safe schema and migrations |
| Auth | JWT + API Keys | Dashboard users and worker authentication |
| Metrics | Prometheus format endpoint | Easy Grafana integration later |
| Logs | PostgreSQL for MVP, object storage later | Searchable job/worker logs |
| Artifact Storage | Local disk for MVP, S3/R2/MinIO later | Store reports, files, screenshots, output archives |
| Containerization | Docker + Docker Compose | Easy local and VPS deployment |
| Reverse Proxy | Caddy or Nginx | HTTPS and routing |
| Process Manager | PM2 or Docker restart policies | Keep master alive |

---

## 2. Frontend Stack

### Recommended

- React
- Vite
- TypeScript
- TailwindCSS
- shadcn/ui
- React Query / TanStack Query
- Socket.IO Client
- Recharts
- Zustand or Redux Toolkit for local UI state

### Why

The dashboard needs realtime state, tables, charts, filtering, and admin actions. React with TanStack Query and Socket.IO gives a clean split between API state and live events.

### Frontend Pages

- Login
- Dashboard Overview
- Organizations
- Projects
- Provider Accounts
- Worker Pools
- Workers
- Jobs
- Job Details
- Logs
- Artifacts
- Secrets
- API Keys
- Webhooks
- Audit Logs
- Settings

---

## 3. Backend Stack

### Recommended

- Node.js
- Express.js
- TypeScript
- Prisma
- PostgreSQL
- Redis
- BullMQ
- Socket.IO
- Zod for request validation
- Pino for structured logging

### Why

This stack is lightweight, widely supported, and fits the product goal. BullMQ is especially useful because it already supports retries, delayed jobs, priorities, job states, and Redis-backed persistence.

---

## 4. Worker Stack

### Recommended Worker Runtime

- Node.js + TypeScript for the first worker implementation
- Optional Python worker later for data/scanning jobs
- Docker support for isolated execution

### Worker Responsibilities

- Register with master
- Authenticate using worker token
- Send heartbeats
- Report metrics
- Pull or receive jobs
- Execute jobs
- Stream logs
- Send progress updates
- Upload artifacts
- Report completion/failure
- Reconnect automatically

---

## 5. Infrastructure Stack

### MVP Local Development

Use Docker Compose:

- master-api
- dashboard
- postgres
- redis
- worker

### Production MVP

Recommended minimum deployment:

- One VPS for master API, dashboard, Redis, PostgreSQL
- Workers deployed separately on VPS, Render, Railway, Oracle Cloud, or local machines
- Caddy or Nginx for HTTPS
- Daily PostgreSQL backups

### Future Production

- Managed PostgreSQL
- Managed Redis
- Object storage such as Cloudflare R2, S3, MinIO, or Backblaze B2
- Multiple API replicas behind load balancer
- Separate scheduler service
- Separate websocket service

---

## 6. Versioning Recommendations

Use versions from the start:

- API: `/api/v1`
- Worker protocol: `protocolVersion: "v1"`
- Worker agent: `workerVersion: "0.1.0"`
- Job schema: `jobSchemaVersion: "v1"`

---

## 7. Recommended Package Structure

```text
nebula-cluster/
 ├── apps/
 │    ├── api/
 │    ├── dashboard/
 │    └── worker/
 ├── packages/
 │    ├── shared/
 │    ├── config/
 │    ├── types/
 │    └── sdk-js/
 ├── docker-compose.yml
 ├── README.md
 └── docs/
```

Use a monorepo so shared types can be reused between API, dashboard, worker, and SDK.

---

## 8. Recommended Libraries

### Backend

```text
express
socket.io
bullmq
ioredis
@prisma/client
prisma
zod
jsonwebtoken
bcryptjs
pino
pino-http
dotenv
helmet
cors
express-rate-limit
nanoid
```

### Frontend

```text
react
vite
typescript
@tanstack/react-query
socket.io-client
recharts
zustand
react-router-dom
lucide-react
tailwindcss
class-variance-authority
clsx
tailwind-merge
```

### Worker

```text
socket.io-client
systeminformation
pino
zod
execa
axios
form-data
```

---

## 9. What Not to Use in MVP

Avoid these until the core product works:

- Kubernetes
- Microservices everywhere
- Complex service mesh
- Full autoscaling engine
- Custom queue system
- Custom auth provider
- Full plugin marketplace
- Complex multi-region master setup

Keep the MVP simple and reliable.
