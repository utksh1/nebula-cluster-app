# Nebula Cluster — MVP Build Plan

## 1. MVP Objective

Create a working distributed compute platform where:

- A master server runs centrally
- One or more workers connect to it
- A user can create jobs from dashboard/API
- Jobs are executed by workers
- Logs and progress appear live
- Failed/stuck jobs are retried or marked failed

---

## 2. MVP Scope

### Must Have

- User login
- Project creation
- Worker registration
- Worker heartbeat
- Worker status page
- Job creation API
- Job queue with BullMQ
- Worker job polling
- Job execution
- Job logs
- Job progress
- Job result reporting
- Retry policy
- Timeout policy
- Basic dashboard

### Should Have

- Worker pools
- Provider account field
- Job cancellation
- Drain mode
- Dead letter queue
- Idempotency keys

### Not MVP

- Docker execution
- Autoscaling
- Kubernetes
- Complex billing
- Plugin marketplace
- Full provider deployment automation

---

## 3. First Job Types

Start with safe job types:

### HTTP Request Job

Payload:

```json
{
  "url": "https://example.com",
  "method": "GET"
}
```

### Sleep/Test Job

Payload:

```json
{
  "durationSec": 10
}
```

### Scripted Internal Job

Predefined server-side/worker-side handler such as:

```text
ping_url
fetch_html
generate_random_report
```

Avoid arbitrary shell execution in the first MVP.

---

## 4. MVP Database Tables

Minimum tables:

```text
users
organizations
projects
provider_accounts
worker_pools
workers
worker_heartbeats
jobs
job_attempts
job_logs
api_keys
audit_logs
```

Artifacts, secrets, webhooks, and pipelines can be added next.

---

## 5. MVP API Endpoints

```http
POST /api/v1/auth/login
GET  /api/v1/projects
POST /api/v1/projects
POST /api/v1/workers/register
POST /api/v1/workers/heartbeat
GET  /api/v1/workers
POST /api/v1/jobs
GET  /api/v1/jobs
GET  /api/v1/jobs/:jobId
POST /api/v1/jobs/:jobId/cancel
GET  /api/v1/jobs/:jobId/logs
GET  /api/v1/queues/default/stats
```

Worker-specific:

```http
GET  /api/v1/workers/:workerId/tasks/next
POST /api/v1/jobs/:jobId/progress
POST /api/v1/jobs/:jobId/logs
POST /api/v1/jobs/:jobId/result
POST /api/v1/jobs/:jobId/lease/renew
```

---

## 6. MVP Dashboard Pages

### Dashboard Overview

Cards:

- Total workers
- Online workers
- Offline workers
- Running jobs
- Queued jobs
- Failed jobs
- Queue latency

### Workers Page

Table:

- Name
- Provider
- Account
- Pool
- Status
- CPU
- RAM
- Active jobs
- Last heartbeat

### Jobs Page

Table:

- Job ID
- Type
- Status
- Priority
- Worker
- Attempts
- Created at
- Duration

### Job Detail Page

Sections:

- Job metadata
- Payload
- Requirements
- Progress
- Logs
- Result
- Error

---

## 7. Suggested Build Order

```text
1. Create repo and Docker Compose
2. Add PostgreSQL, Redis, Prisma
3. Create API server
4. Add auth and user seed
5. Add worker registration
6. Add heartbeat loop
7. Build simple worker
8. Add jobs table and create-job API
9. Add BullMQ
10. Add worker polling
11. Add job result reporting
12. Add logs/progress
13. Add dashboard pages
14. Add retries/timeouts
15. Add stuck-job detection
```

---

## 8. MVP Acceptance Criteria

MVP is complete when:

- User can log in
- User can see dashboard
- Worker can register
- Worker appears online
- User can create a job
- Worker receives the job
- Job status changes to running
- Logs stream to dashboard
- Progress updates appear
- Job finishes successfully
- Failed jobs retry
- Dead/stale jobs are requeued
- Offline workers are detected

---

## 9. Suggested Demo Flow

```text
1. Start master with Docker Compose
2. Start two workers
3. Open dashboard
4. Submit HTTP job
5. Watch worker pick job
6. Watch logs stream
7. Stop one worker
8. Confirm worker goes offline
9. Submit another job
10. Confirm remaining worker executes it
```
