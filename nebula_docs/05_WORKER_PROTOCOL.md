# Nebula Cluster — Worker Protocol

## 1. Purpose

The worker protocol defines how Nebula workers communicate with the master control plane.

The protocol must support:

- Worker registration
- Authentication
- Heartbeats
- Metrics
- Job assignment
- Job execution
- Logs
- Progress
- Results
- Artifact uploads
- Cancellation
- Draining
- Reconnection

---

## 2. Worker Configuration

Workers should be configurable using environment variables:

```bash
NEBULA_MASTER_URL=https://nebula.example.com
NEBULA_WORKER_TOKEN=worker_token_here
NEBULA_PROVIDER=render
NEBULA_PROVIDER_ACCOUNT_ID=acct_1
NEBULA_PROJECT_ID=project_1
NEBULA_WORKER_POOL_ID=pool_1
NEBULA_WORKER_NAME=render-worker-1
NEBULA_MAX_CONCURRENT_JOBS=2
```

---

## 3. Worker Registration

Endpoint:

```http
POST /api/v1/workers/register
```

Payload:

```json
{
  "nodeId": "worker-7",
  "name": "render-worker-7",
  "provider": "render",
  "providerAccountId": "acct_1",
  "projectId": "project_1",
  "workerPoolId": "pool_1",
  "region": "oregon",
  "cpuCores": 1,
  "memoryMb": 512,
  "maxConcurrentJobs": 2,
  "capabilities": {
    "supportsDocker": false,
    "supportsShell": true,
    "supportsHttp": true,
    "jobTypes": ["scrape", "http", "automation"]
  },
  "tags": ["scraping", "low-cost"],
  "trustLevel": "semi_trusted",
  "workerVersion": "0.1.0",
  "protocolVersion": "v1"
}
```

---

## 4. Heartbeats

Recommended interval: every 5–15 seconds.

Endpoint:

```http
POST /api/v1/workers/heartbeat
```

Payload:

```json
{
  "workerId": "worker_1",
  "status": "ONLINE",
  "cpuUsage": 32.4,
  "memoryUsage": 61.9,
  "networkRx": 102400,
  "networkTx": 204800,
  "activeJobs": 1,
  "uptimeSec": 3600
}
```

If the master does not receive heartbeats within the configured timeout, the worker becomes `OFFLINE`.

---

## 5. Job Assignment Model

MVP options:

### Pull Model

Worker polls for jobs:

```http
GET /api/v1/workers/:workerId/tasks/next
```

### Push Model

Master sends job over websocket:

```text
job:assigned
```

Recommended MVP: start with pull model because it is simpler and resilient. Add websocket push later for faster dispatch.

---

## 6. Job Payload

```json
{
  "id": "job_123",
  "type": "scrape_url",
  "priority": 5,
  "payload": {
    "url": "https://example.com"
  },
  "requirements": {
    "cpu": 1,
    "memoryMb": 512,
    "timeoutSec": 300,
    "requiresDocker": false
  },
  "retry": {
    "maxAttempts": 3,
    "backoff": "exponential"
  },
  "lease": {
    "leaseToken": "lease_token_abc",
    "expiresAt": "2026-05-28T10:00:00Z"
  }
}
```

---

## 7. Job Lease Renewal

Workers must renew active job leases.

Endpoint:

```http
POST /api/v1/jobs/:jobId/lease/renew
```

Payload:

```json
{
  "leaseToken": "lease_token_abc"
}
```

If the lease expires, the master can mark the job as stale and requeue it.

---

## 8. Job Progress

Endpoint:

```http
POST /api/v1/jobs/:jobId/progress
```

Payload:

```json
{
  "progress": 65,
  "stage": "extracting_data",
  "message": "Processed 650 of 1000 URLs"
}
```

---

## 9. Job Logs

Endpoint:

```http
POST /api/v1/jobs/:jobId/logs
```

Payload:

```json
{
  "level": "INFO",
  "message": "Starting scrape",
  "metadata": {
    "url": "https://example.com"
  },
  "timestamp": "2026-05-28T10:00:00Z"
}
```

Workers should batch logs if many logs are produced.

---

## 10. Job Completion

Endpoint:

```http
POST /api/v1/jobs/:jobId/result
```

Payload:

```json
{
  "leaseToken": "lease_token_abc",
  "status": "COMPLETED",
  "result": {
    "itemsProcessed": 1000
  },
  "artifacts": ["artifact_1"]
}
```

---

## 11. Job Failure

Endpoint:

```http
POST /api/v1/jobs/:jobId/result
```

Payload:

```json
{
  "leaseToken": "lease_token_abc",
  "status": "FAILED",
  "error": {
    "message": "Request timed out",
    "code": "TIMEOUT",
    "stack": "optional_stack_trace"
  }
}
```

---

## 12. Cancellation

Master may request cancellation.

Event:

```text
job:cancel
```

Payload:

```json
{
  "jobId": "job_123",
  "reason": "Cancelled by user",
  "gracePeriodSec": 10
}
```

Worker should:

1. Stop accepting new work for that job
2. Send SIGTERM or equivalent
3. Wait grace period
4. Force kill if needed
5. Report `CANCELLED`

---

## 13. Drain Mode

When a worker enters drain mode:

- It stops accepting new jobs
- It finishes active jobs
- It continues heartbeats
- It exits or becomes disabled after active jobs finish

Event:

```text
worker:drain
```

---

## 14. Reconnect Logic

Workers should use exponential backoff:

```text
1s → 2s → 5s → 10s → 30s → 60s max
```

After reconnecting, the worker should:

- Re-register or refresh registration
- Send heartbeat
- Report active jobs if any
- Ask master whether to continue, cancel, or requeue active jobs

---

## 15. Worker Execution Modes

Supported modes:

```text
function
shell
http
script
docker
plugin
```

MVP should support:

```text
function
http
shell with restrictions
```

Docker execution should be added only after sandbox/security controls are ready.
