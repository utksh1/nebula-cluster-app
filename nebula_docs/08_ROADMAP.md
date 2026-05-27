# Nebula Cluster — Implementation Roadmap

## Phase 0 — Foundation

Goal: prepare repo and core development setup.

Tasks:

- Create monorepo
- Add TypeScript config
- Add Docker Compose
- Add PostgreSQL and Redis
- Add Prisma schema
- Add shared types package
- Add API app skeleton
- Add dashboard app skeleton
- Add worker app skeleton

Deliverable:

```text
Repo runs locally with API, dashboard, database, Redis, and one worker.
```

---

## Phase 1 — Core MVP

Goal: basic distributed job execution.

Tasks:

- User login
- Organization/project models
- Worker registration
- Worker heartbeat
- Worker status tracking
- Basic worker list page
- Job creation API
- BullMQ queue integration
- Worker job polling
- Job execution handler
- Job result reporting
- Basic dashboard overview

Deliverable:

```text
User can register a worker, submit a job, and see it complete.
```

---

## Phase 2 — Realtime Monitoring

Goal: live cluster visibility.

Tasks:

- Socket.IO server
- Dashboard websocket client
- Realtime worker status
- Realtime job status
- Realtime job logs
- Job progress updates
- Queue metrics
- Worker CPU/RAM metrics
- Logs page
- Job detail page

Deliverable:

```text
Dashboard updates live while workers execute jobs.
```

---

## Phase 3 — Reliability

Goal: safe failure recovery.

Tasks:

- Retry policies
- Exponential backoff
- Job timeout
- Job cancellation
- Job leases
- Lease renewal
- Stuck job detection
- Dead letter queue
- Worker drain mode
- Requeue jobs from failed workers
- Idempotency keys

Deliverable:

```text
Jobs survive worker failures and can be retried, cancelled, or inspected.
```

---

## Phase 4 — Multi-Account and Worker Pools

Goal: organize many workers across cloud/provider accounts.

Tasks:

- Provider accounts table
- Provider account dashboard page
- Worker pools
- Account-aware scheduling
- Pool-aware scheduling
- Provider/account limits
- Region metadata
- Worker trust levels
- Worker install command generator

Deliverable:

```text
User can manage workers across multiple provider accounts and pools.
```

---

## Phase 5 — Security and Secrets

Goal: improve production safety.

Tasks:

- API key management
- Secret creation and encryption
- Secret masking in logs
- RBAC roles
- Audit logs
- Rate limiting
- Token rotation
- Webhook signing
- Request validation hardening

Deliverable:

```text
Platform has safe authentication, authorization, secrets, and audit history.
```

---

## Phase 6 — Artifacts and Webhooks

Goal: support real automation workflows.

Tasks:

- Artifact upload
- Local artifact storage
- S3/R2/MinIO storage adapter
- Artifact download links
- Webhook creation
- Webhook delivery retries
- Notification channels
- Result export

Deliverable:

```text
Jobs can produce files and notify external systems.
```

---

## Phase 7 — Execution Modes

Goal: support more useful job runtimes.

Tasks:

- Function jobs
- HTTP jobs
- Restricted shell jobs
- Docker jobs
- Timeout/kill enforcement
- Resource limits
- Per-job environment variables
- Plugin-style job handlers

Deliverable:

```text
Nebula can run multiple classes of jobs safely.
```

---

## Phase 8 — Pipelines

Goal: support multi-step workflows.

Tasks:

- Pipeline definitions
- Parent/child jobs
- Job dependencies
- Pipeline run tracking
- Pipeline graph view
- Retry failed stage
- Clone pipeline run

Deliverable:

```text
User can run multi-step workflows like crawl → scan → report.
```

---

## Phase 9 — Observability and Ops

Goal: production-grade operations.

Tasks:

- Prometheus endpoint
- Grafana dashboard templates
- Queue backpressure
- Alert rules
- Log retention jobs
- Metrics retention jobs
- Admin emergency controls
- Maintenance mode

Deliverable:

```text
Operators can monitor and control the cluster safely.
```

---

## Phase 10 — CLI and SDK

Goal: developer-friendly usage.

Tasks:

- JavaScript/TypeScript SDK
- CLI login
- CLI worker list
- CLI job create
- CLI job logs
- CLI job cancel/retry
- CLI worker drain

Deliverable:

```text
Developers can use Nebula from terminal and code.
```

---

## MVP Must-Have List

Build these first:

```text
1. API server
2. PostgreSQL schema
3. Redis + BullMQ
4. Worker registration
5. Heartbeats
6. Job creation
7. Worker job execution
8. Job results
9. Basic dashboard
10. Realtime logs
11. Retries
12. Timeouts
13. Stuck job detection
```

## Avoid in Early MVP

Avoid:

```text
Kubernetes integration
Autoscaling
Full plugin marketplace
Complex provider API automation
Multi-region master
AI inference workloads
Complex billing system
```
