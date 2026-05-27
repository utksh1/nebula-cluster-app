# Nebula Cluster — API Specification

## 1. API Versioning

All APIs should use versioned routes:

```http
/api/v1
```

Example:

```http
POST /api/v1/jobs
GET /api/v1/workers
```

---

## 2. Authentication Types

| Client | Auth Method |
|---|---|
| Dashboard user | JWT session token |
| API integration | API key |
| Worker node | Worker token |
| Webhook receiver | Signed webhook secret |

---

## 3. Auth APIs

### Login

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response:

```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_1",
    "email": "user@example.com"
  }
}
```

---

## 4. Organization APIs

```http
GET    /api/v1/orgs
POST   /api/v1/orgs
GET    /api/v1/orgs/:orgId
PATCH  /api/v1/orgs/:orgId
DELETE /api/v1/orgs/:orgId
```

---

## 5. Project APIs

```http
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:projectId
PATCH  /api/v1/projects/:projectId
DELETE /api/v1/projects/:projectId
```

Create project request:

```json
{
  "organizationId": "org_1",
  "name": "Security Scanning",
  "description": "Distributed scanning jobs"
}
```

---

## 6. Provider Account APIs

```http
GET    /api/v1/provider-accounts
POST   /api/v1/provider-accounts
GET    /api/v1/provider-accounts/:accountId
PATCH  /api/v1/provider-accounts/:accountId
DELETE /api/v1/provider-accounts/:accountId
POST   /api/v1/provider-accounts/:accountId/rotate-token
```

Create provider account request:

```json
{
  "organizationId": "org_1",
  "provider": "render",
  "accountName": "Render Account 2",
  "region": "oregon",
  "credentials": {
    "apiKey": "secret_value"
  }
}
```

---

## 7. Worker APIs

### Register Worker

```http
POST /api/v1/workers/register
```

Request:

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
    "jobTypes": ["scrape", "http", "automation"]
  },
  "workerVersion": "0.1.0",
  "protocolVersion": "v1"
}
```

### Heartbeat

```http
POST /api/v1/workers/heartbeat
```

Request:

```json
{
  "workerId": "worker_1",
  "status": "ONLINE",
  "cpuUsage": 35.4,
  "memoryUsage": 62.1,
  "activeJobs": 1,
  "uptimeSec": 1337
}
```

### List Workers

```http
GET /api/v1/workers
```

Query filters:

```text
projectId
provider
providerAccountId
status
workerPoolId
region
```

### Drain Worker

```http
POST /api/v1/workers/:workerId/drain
```

### Disable Worker

```http
POST /api/v1/workers/:workerId/disable
```

---

## 8. Worker Pool APIs

```http
GET    /api/v1/worker-pools
POST   /api/v1/worker-pools
GET    /api/v1/worker-pools/:poolId
PATCH  /api/v1/worker-pools/:poolId
DELETE /api/v1/worker-pools/:poolId
```

Create worker pool:

```json
{
  "projectId": "project_1",
  "name": "scanner-pool",
  "description": "Workers optimized for security scanning",
  "allowedJobTypes": ["scan", "http", "shell"],
  "minTrustLevel": "trusted"
}
```

---

## 9. Job APIs

### Create Job

```http
POST /api/v1/jobs
Idempotency-Key: unique-client-key
```

Request:

```json
{
  "projectId": "project_1",
  "type": "scrape_url",
  "priority": 5,
  "payload": {
    "url": "https://example.com"
  },
  "requirements": {
    "cpu": 1,
    "memoryMb": 512,
    "timeoutSec": 300,
    "workerPoolId": "pool_1",
    "provider": "any",
    "providerAccountId": "any",
    "region": "any",
    "requiresDocker": false,
    "requiresTrustLevel": "semi_trusted"
  },
  "retry": {
    "maxAttempts": 3,
    "backoff": "exponential"
  },
  "webhookUrl": "https://example.com/webhook"
}
```

Response:

```json
{
  "id": "job_123",
  "status": "QUEUED"
}
```

### List Jobs

```http
GET /api/v1/jobs
```

Filters:

```text
projectId
status
type
workerId
providerAccountId
createdBy
```

### Get Job

```http
GET /api/v1/jobs/:jobId
```

### Cancel Job

```http
POST /api/v1/jobs/:jobId/cancel
```

### Retry Job

```http
POST /api/v1/jobs/:jobId/retry
```

### Get Job Logs

```http
GET /api/v1/jobs/:jobId/logs
```

### Get Job Artifacts

```http
GET /api/v1/jobs/:jobId/artifacts
```

---

## 10. Queue APIs

```http
GET  /api/v1/queues
GET  /api/v1/queues/:queueName/stats
POST /api/v1/queues/:queueName/pause
POST /api/v1/queues/:queueName/resume
```

---

## 11. Secret APIs

```http
GET    /api/v1/secrets
POST   /api/v1/secrets
PATCH  /api/v1/secrets/:secretId
DELETE /api/v1/secrets/:secretId
```

Create secret:

```json
{
  "projectId": "project_1",
  "name": "OPENAI_API_KEY",
  "scope": "project",
  "value": "secret_value",
  "availableTo": ["worker-tag:ai"]
}
```

Secret values should never be returned after creation.

---

## 12. Artifact APIs

```http
GET  /api/v1/artifacts
GET  /api/v1/artifacts/:artifactId
POST /api/v1/artifacts/upload-url
```

---

## 13. Webhook APIs

```http
GET    /api/v1/webhooks
POST   /api/v1/webhooks
PATCH  /api/v1/webhooks/:webhookId
DELETE /api/v1/webhooks/:webhookId
POST   /api/v1/webhooks/:webhookId/test
```

Supported events:

```text
job.created
job.started
job.completed
job.failed
worker.online
worker.offline
queue.overloaded
provider_account.rate_limited
```

---

## 14. Audit Log APIs

```http
GET /api/v1/audit-logs
```

Filters:

```text
organizationId
projectId
actorUserId
action
targetType
from
to
```

---

## 15. Metrics APIs

```http
GET /api/v1/metrics/overview
GET /api/v1/metrics/workers
GET /api/v1/metrics/jobs
GET /api/v1/metrics/prometheus
```

Prometheus endpoint should expose metrics in text format.
