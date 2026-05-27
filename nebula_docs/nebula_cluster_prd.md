# Nebula Cluster — Product Requirements Document

## 1. Overview

### Product Name

**Nebula Cluster**

### Product Type

Distributed Compute & Worker Orchestration Platform

### Product Vision

Nebula Cluster is a lightweight distributed orchestration platform for managing worker nodes hosted across multiple cloud providers, provider accounts, VPS machines, Docker hosts, and local systems through a centralized control plane and web dashboard.

The platform should allow users to:

- Register and manage distributed workers
- Dispatch jobs and tasks to workers
- Monitor health, metrics, logs, queues, and execution status
- Stream realtime logs and job progress
- Scale horizontally by adding more workers
- Operate across multiple cloud providers and accounts
- Support automation, scraping, rendering, compute jobs, background tasks, security scans, and custom execution pipelines

Nebula Cluster is **not** intended to merge physical RAM into a single machine. It is not a shared-memory supercomputer.

Instead, it should function as:

- A distributed execution system
- A parallel task platform
- A worker orchestration infrastructure
- A lightweight control plane for distributed background workloads

---

## 2. Goals

### G1 — Distributed Worker Management

Allow multiple worker nodes to connect to one central control plane.

### G2 — Job Distribution

Distribute jobs efficiently among available workers using worker health, capacity, capabilities, pools, provider accounts, and scheduling rules.

### G3 — Realtime Monitoring

Provide live monitoring of:

- Worker health
- CPU usage
- Memory usage
- Network usage
- Uptime
- Running jobs
- Queue statistics
- Job progress
- Failure rate
- Provider account status

### G4 — Multi-Provider Support

Support workers from:

- Render
- Railway
- Oracle Cloud
- Docker VPS
- Local machines
- Cloud VMs
- Bare-metal systems
- Future providers through adapters

### G5 — Multi-Account Support

Support multiple provider accounts under one organization or workspace.

Example:

```text
Organization: Utkarsh Workspace
 ├── Render Account 1
 ├── Render Account 2
 ├── Oracle Cloud Account
 ├── Railway Account
 └── Local VPS Pool
```

### G6 — Centralized Dashboard

Provide a web dashboard for:

- Monitoring
- Orchestration
- Deployment visibility
- Worker control
- Log viewing
- Queue management
- Provider account management
- Secrets management
- Project management
- Audit visibility

### G7 — Reliability

Ensure:

- Reconnect logic
- Retry mechanisms
- Task persistence
- Worker heartbeat validation
- Job lease renewal
- Stuck job detection
- Dead letter queue support
- Timeout and cancellation handling

### G8 — Extensibility

Allow future support for:

- Docker execution
- Plugin system
- Pipelines
- Webhooks
- SDKs
- CLI
- Autoscaling
- Kubernetes integration

---

## 3. Non-Goals

The platform will **not**:

- Combine RAM into one memory pool
- Function as a hypervisor
- Fully emulate Kubernetes
- Provide kernel-level virtualization
- Provide shared-memory computing
- Replace enterprise orchestration platforms
- Guarantee hard realtime execution
- Execute untrusted code without sandboxing

---

## 4. Target Users

### Developers

Developers needing distributed execution infrastructure for background jobs, automation, rendering, APIs, and scripts.

### Security Researchers

Users running:

- Distributed scanners
- Recon workflows
- Vulnerability checks
- Monitoring jobs
- Report generation

### Automation Engineers

Users executing:

- Background tasks
- Web scraping
- Queue-based processing
- Scheduled jobs
- Data collection pipelines

### Students & Hobbyists

Users learning:

- Distributed systems
- Orchestration
- Worker design
- Infrastructure engineering
- Cloud deployment

### Small Teams

Small teams needing a lightweight job execution platform without the operational complexity of Kubernetes.

---

## 5. Core Product Model

Nebula Cluster should use the following hierarchy:

```text
Organization
 └── Project
      ├── Provider Accounts
      ├── Worker Pools
      │    └── Workers
      ├── Queues
      ├── Jobs
      ├── Pipelines
      ├── Logs
      ├── Metrics
      ├── Artifacts
      ├── Secrets
      ├── Webhooks
      ├── API Keys
      └── Audit Logs
```

### Organization

A top-level workspace containing users, teams, projects, provider accounts, workers, jobs, and secrets.

### Project

A logical workspace for a specific workload type.

Example projects:

- Security Scanning
- Web Scraping
- PDF Rendering
- Background Automation
- AI Experiments
- Monitoring

### Provider Account

Represents an external cloud/provider account such as Render Account 1, Railway Account 2, Oracle Cloud, or a VPS group.

### Worker Pool

A logical group of workers with similar capabilities.

Example pools:

```text
scraping-pool
rendering-pool
scanner-pool
docker-pool
low-cost-pool
high-memory-pool
trusted-pool
```

### Worker

A connected node capable of executing jobs.

### Job

A unit of work submitted to the platform.

### Pipeline

A sequence or graph of jobs with dependencies.

---

## 6. High-Level Architecture

```text
                          Web Dashboard
                               |
                               v
                        API Gateway / Auth
                               |
                               v
                       Control Plane API
                               |
        ------------------------------------------------
        |                    |                         |
   PostgreSQL              Redis                  WebSocket Hub
        |                    |                         |
        |              BullMQ Queues                   |
        |                    |                         |
        ------------------------------------------------
                               |
                               v
                        Scheduler Service
                               |
                               v
        ------------------------------------------------
        |             |              |                 |
   Worker Node   Worker Node    Worker Node      Worker Node
   Render        Oracle VPS     Railway          Local Docker
        |             |              |                 |
        ------------------------------------------------
                               |
                               v
                    Logs / Metrics / Artifacts
```

---

## 7. Control Plane vs Data Plane

### Control Plane

Responsible for:

- Authentication
- Users and organizations
- Projects
- Provider accounts
- Worker registry
- Job metadata
- Scheduling decisions
- Queue coordination
- Dashboard APIs
- Audit logs

### Data Plane

Responsible for:

- Actual job execution
- Worker runtime
- Logs
- Metrics
- Artifacts
- Results
- Runtime health

This separation keeps the system clean and prepares it for future scaling.

---

## 8. Core Components

## 8.1 Frontend Dashboard

### Responsibilities

- Display cluster status
- Show worker metrics
- Display queue statistics
- Stream logs
- Manage workers
- Manage worker pools
- Trigger jobs
- Configure projects
- Configure provider accounts
- Manage secrets
- View artifacts
- View audit logs
- Control emergency actions

### Recommended Tech Stack

- React
- TailwindCSS
- Socket.IO Client
- React Query
- Recharts or Chart.js
- Zustand or Redux Toolkit for local state

### Core Pages

#### Dashboard Overview

Displays:

- Total workers
- Online workers
- Offline workers
- Busy workers
- Draining workers
- Active jobs
- Queue size
- CPU utilization
- Memory usage
- Failed jobs
- Provider account health
- Recent failures

#### Projects Page

Displays:

- Projects
- Job count per project
- Worker pools per project
- Secrets per project
- Webhooks per project
- Usage statistics

#### Provider Accounts Page

Displays:

| Account | Provider | Workers | Status | Region | Actions |
|---|---|---:|---|---|---|
| Render Main | Render | 4 | Connected | Oregon | Manage |
| Render Backup | Render | 2 | Connected | Frankfurt | Manage |
| Oracle Free | Oracle | 1 | Connected | Mumbai | Manage |
| Local VPS | Docker VPS | 3 | Online | India | Manage |

Actions:

- Connect account
- Disconnect account
- Rotate credentials
- View workers
- Deploy worker
- Disable account
- Set account limits

#### Worker Pools Page

Displays:

- Pool name
- Worker count
- Capabilities
- Trust level
- Allowed job types
- Current load

#### Workers Page

Displays:

- Worker status
- Worker metadata
- Provider information
- Provider account
- Region
- Uptime
- Last heartbeat
- Current tasks
- Worker version
- Supported features
- Trust level

#### Jobs Page

Displays:

- Queued jobs
- Running jobs
- Completed jobs
- Failed jobs
- Retrying jobs
- Cancelled jobs
- Timed-out jobs
- Dead letter jobs
- Retry status
- Job progress
- Assigned worker

#### Pipelines Page

Displays:

- Pipeline definitions
- Pipeline runs
- Dependency graph
- Failed stages
- Retry controls

#### Logs Page

Displays:

- Realtime logs
- Filtering
- Search
- Severity
- Worker mapping
- Job mapping
- Export support

#### Artifacts Page

Displays:

- Job outputs
- Reports
- Screenshots
- JSON results
- Rendered files
- Download links

#### Secrets Page

Allows:

- Create secrets
- Rotate secrets
- Scope secrets
- View usage metadata
- Never reveal secret values after creation

#### Settings Page

Allows:

- API key management
- Queue settings
- Worker timeout configuration
- Retry configuration
- Notification settings
- Webhook settings
- Log retention settings
- Emergency controls

---

## 8.2 Master API Server

### Responsibilities

- Authentication
- Worker registration
- Job scheduling
- Task assignment
- Metrics aggregation
- WebSocket broadcasting
- Retry handling
- Health management
- Provider account management
- Project management
- Secrets management
- Audit logging

### Recommended Stack

- Node.js
- Express.js or Fastify
- Socket.IO
- BullMQ
- Redis
- PostgreSQL
- Prisma or Drizzle ORM

### API Modules

#### Authentication Module

Handles:

- Login
- JWT tokens
- API tokens
- Session management
- Role-based access control

#### Organization Module

Handles:

- Organizations
- Members
- Roles
- Workspace settings

#### Project Module

Handles:

- Project creation
- Project configuration
- Project quotas
- Project-level secrets
- Project-level workers

#### Provider Account Module

Handles:

- Provider account creation
- Credential storage
- Credential rotation
- Account health
- Account limits
- Provider metadata

#### Worker Management Module

Handles:

- Worker registration
- Heartbeat validation
- Worker metadata
- Status management
- Worker draining
- Worker trust levels
- Worker version tracking

#### Worker Pool Module

Handles:

- Pool creation
- Pool assignment
- Pool scheduling rules
- Pool capabilities

#### Queue Module

Handles:

- Job creation
- Job retry
- Scheduling
- Prioritization
- Backpressure
- Dead letter queue

#### Scheduler Module

Handles:

- Worker selection
- Capability matching
- Account-aware placement
- Pool-aware placement
- Trust-aware placement
- Capacity-aware assignment

#### Metrics Module

Handles:

- CPU tracking
- Memory tracking
- Network tracking
- Uptime tracking
- Throughput metrics
- Queue latency

#### Log Module

Handles:

- Log streaming
- Log storage
- Filtering
- Retention
- Export

#### Artifact Module

Handles:

- Artifact metadata
- Upload links
- Storage backends
- Download permissions

#### Webhook Module

Handles:

- Webhook registration
- Webhook delivery
- Retry
- Signing
- Failure logs

#### Audit Module

Handles:

- Security logs
- User action logs
- Admin action logs
- Token rotation logs

---

## 8.3 Redis Queue Layer

### Responsibilities

- Job queue storage
- Task scheduling
- Delayed jobs
- Retries
- Distributed job dispatching
- Dead letter queue
- Queue pause/resume
- Backpressure signals

### Recommended Library

- BullMQ

### Queue Types

#### Standard Queue

Used for normal tasks.

#### Priority Queue

Used for urgent jobs.

#### Delayed Queue

Used for scheduled jobs.

#### Retry Queue

Used for failed jobs that are eligible for retry.

#### Dead Letter Queue

Used for jobs that exhausted retry attempts.

#### Pipeline Queue

Used for dependency-based pipeline stages.

---

## 8.4 Worker Nodes

### Responsibilities

- Connect to master
- Register itself
- Process tasks
- Renew job leases
- Send metrics
- Stream logs
- Send progress
- Upload artifacts
- Reconnect automatically
- Respect cancellation and drain signals

### Worker Features

#### Self Registration

Worker auto-registers during startup using a token.

#### Heartbeats

Worker sends periodic health updates.

#### Task Execution

Worker processes assigned jobs.

#### Job Lease Renewal

Worker renews job leases while jobs are running.

#### Reconnect Logic

Worker reconnects automatically after network or master failure.

#### Resource Reporting

Worker reports:

- CPU usage
- RAM usage
- Network usage
- Active tasks
- Uptime
- Disk usage if available

#### Progress Reporting

Worker sends job progress updates.

Example:

```json
{
  "jobId": "job_123",
  "progress": 65,
  "stage": "extracting_data",
  "message": "Processed 650 of 1000 URLs"
}
```

---

## 9. Execution Modes

Nebula Cluster should support multiple execution modes.

| Mode | Description |
|---|---|
| `function` | Worker runs predefined internal job handlers |
| `shell` | Worker executes shell commands |
| `docker` | Worker runs job inside a Docker container |
| `http` | Worker calls an external HTTP endpoint |
| `script` | Worker runs uploaded or custom scripts |
| `plugin` | Worker loads user-defined job modules |
| `pipeline` | Worker executes part of a multi-step workflow |

### Important Security Rule

Untrusted code execution should only be allowed inside isolated Docker containers or sandboxed environments.

---

## 10. Worker Lifecycle

### Step 1 — Startup

Worker starts.

### Step 2 — Registration

Worker sends registration request.

Example:

```json
{
  "nodeId": "worker-7",
  "provider": "render",
  "providerAccountId": "acct_render_2",
  "region": "oregon",
  "cpuCores": 1,
  "memoryMb": 512,
  "supportsDocker": false,
  "supportsShell": true,
  "maxConcurrentJobs": 2,
  "tags": ["scraping", "lightweight"],
  "workerVersion": "0.1.0",
  "protocolVersion": "v1"
}
```

### Step 3 — Authentication

Master validates worker token.

### Step 4 — Capability Registration

Master stores worker capabilities.

### Step 5 — Heartbeats

Worker sends heartbeat every few seconds.

### Step 6 — Queue Subscription

Worker subscribes to eligible queues or polls for jobs.

### Step 7 — Job Lease Acquisition

Worker receives job and lease.

### Step 8 — Job Processing

Worker executes job.

### Step 9 — Logs, Metrics, and Progress

Worker streams logs and progress.

### Step 10 — Result Reporting

Worker sends results and uploads artifacts if needed.

### Step 11 — Completion or Retry

Job is marked complete, failed, retrying, timed out, or moved to dead letter queue.

---

## 11. Worker Capabilities

Workers should report capabilities during registration.

Example:

```json
{
  "nodeId": "worker-oracle-01",
  "provider": "oracle",
  "providerAccountId": "acct_oracle_1",
  "region": "ap-mumbai-1",
  "cpuCores": 2,
  "memoryMb": 4096,
  "supportsDocker": true,
  "supportsShell": true,
  "supportsGpu": false,
  "maxConcurrentJobs": 4,
  "tags": ["scraping", "docker", "long-running"],
  "trustLevel": "trusted"
}
```

Scheduler can match jobs based on:

- CPU
- RAM
- Provider
- Provider account
- Region
- Docker support
- Shell support
- Tags
- Worker pool
- Trust level
- Current load
- Job type

---

## 12. Worker Status States

| State | Meaning |
|---|---|
| `ONLINE` | Worker is operational |
| `OFFLINE` | No heartbeat received |
| `BUSY` | Worker is processing tasks |
| `ERROR` | Worker encountered a critical issue |
| `DRAINING` | Worker is finishing current jobs before shutdown |
| `DISABLED` | Worker has been manually disabled |
| `UPDATING` | Worker is being updated |

### Drain Mode

When a worker is draining:

- It does not accept new jobs
- It continues running active jobs
- After active jobs finish, it moves to `OFFLINE` or `DISABLED`
- Admin can force stop if needed

---

## 13. Provider Account Support

Nebula Cluster should support multiple provider accounts under one organization.

Each provider account can contain multiple workers. Jobs may be scheduled globally, by provider, by region, by worker pool, or by specific provider account.

### Provider Account Examples

```text
Render Main
Render Backup
Oracle Free Tier
Railway Account 1
Local Docker VPS
```

### Provider Account Status States

| State | Meaning |
|---|---|
| `CONNECTED` | Account is connected and usable |
| `DISCONNECTED` | Account is disconnected |
| `AUTH_FAILED` | Credentials are invalid |
| `RATE_LIMITED` | Provider rate limits reached |
| `DISABLED` | Account manually disabled |
| `DEGRADED` | Account is partially available |

### Provider Account Limits

Each account should support limits:

```json
{
  "providerAccountId": "acct_render_2",
  "limits": {
    "maxWorkers": 5,
    "maxConcurrentJobs": 20,
    "monthlyJobLimit": 100000,
    "allowedJobTypes": ["scrape", "render", "automation"]
  }
}
```

---

## 14. Worker Installation Flow

Dashboard should generate worker install commands.

### Docker Install

```bash
docker run -d \
  --name nebula-worker-render-2 \
  -e NEBULA_MASTER_URL=https://nebula.example.com \
  -e NEBULA_WORKER_TOKEN=worker_token_xxx \
  -e NEBULA_PROVIDER=render \
  -e NEBULA_PROVIDER_ACCOUNT_ID=acct_render_2 \
  nebula/worker:latest
```

### Script Install

```bash
curl -fsSL https://nebula.example.com/install-worker.sh | bash
```

The install command should be scoped to:

- Organization
- Project
- Provider account
- Worker pool
- Trust level
- Worker token

---

## 15. Job Lifecycle

### Step 1 — User Creates Job

User creates job from dashboard, API, SDK, CLI, or webhook trigger.

### Step 2 — Master Validates Job

Master validates:

- Payload
- Permissions
- Quotas
- Idempotency key
- Required capabilities
- Secret access

### Step 3 — Job Stored

Master stores job metadata in PostgreSQL and queue entry in Redis.

### Step 4 — Scheduler Selects Worker

Scheduler chooses eligible worker.

### Step 5 — Worker Receives Lease

Worker receives job and lease.

### Step 6 — Worker Executes Task

Worker runs job.

### Step 7 — Logs and Progress Streamed

Worker streams logs and progress events.

### Step 8 — Worker Returns Result

Worker sends result and artifacts.

### Step 9 — Job Marked Complete

Job is marked as completed.

### Step 10 — Retry or Dead Letter

If job fails, retry policy applies. If all attempts fail, job moves to dead letter queue.

---

## 16. Job Payload Schema

Example standard job format:

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
    "provider": "any",
    "providerAccountId": "any",
    "region": "any",
    "workerPool": "scraping-pool",
    "requiresDocker": false,
    "requiresTrustLevel": "semi_trusted"
  },
  "retry": {
    "maxAttempts": 3,
    "backoff": "exponential"
  },
  "createdBy": "user_1"
}
```

### Job Placement Example

```json
{
  "type": "scrape_url",
  "payload": {
    "url": "https://example.com"
  },
  "placement": {
    "provider": "render",
    "providerAccountId": "acct_render_2",
    "region": "oregon"
  }
}
```

---

## 17. Job Status States

| State | Meaning |
|---|---|
| `QUEUED` | Waiting for worker |
| `ASSIGNED` | Assigned to worker but not started |
| `RUNNING` | Currently executing |
| `COMPLETED` | Successfully completed |
| `FAILED` | Execution failed |
| `RETRYING` | Scheduled for retry |
| `CANCELLING` | Cancellation requested |
| `CANCELLED` | Stopped manually |
| `TIMEOUT` | Job exceeded allowed runtime |
| `DEAD_LETTER` | Failed permanently after retries |
| `STUCK` | Lease expired or worker stopped reporting |

---

## 18. Scheduling System

### Scheduling Types

#### Immediate Jobs

Run instantly.

#### Delayed Jobs

Run after delay.

#### Cron Jobs

Recurring scheduled jobs.

#### Priority Jobs

Executed before normal jobs.

#### Pipeline Jobs

Run after dependency requirements are met.

### MVP Scheduling Policy

Jobs are assigned using:

1. Worker status must be `ONLINE`
2. Worker must not be `DRAINING` or `DISABLED`
3. Worker must have available capacity
4. Worker must match required capabilities
5. Worker must match worker pool if specified
6. Worker must match provider account if specified
7. Worker must meet trust-level requirements
8. Provider account must be healthy
9. Provider account limits must allow assignment
10. Pick least-loaded account
11. Pick least-loaded worker inside that account
12. Tie-break using lowest CPU usage
13. Fallback to FIFO queue ordering

### Future Scheduling Features

- Weighted scheduling
- Region-aware scheduling
- Cost-aware scheduling
- Provider-aware scheduling
- Worker affinity
- Job pinning
- Fair scheduling
- Quota-aware scheduling

---

## 19. Job Priority and Fair Usage

Nebula should prevent one project or user from starving others.

Support:

- Priority values
- Project quotas
- Organization quotas
- Max concurrent jobs
- Rate limits
- Fair scheduling
- Per-account limits
- Per-pool limits

---

## 20. Job Timeout and Cancellation

Jobs should support timeout and cancellation controls.

Example:

```json
{
  "timeoutSec": 300,
  "cancelOnTimeout": true,
  "killSignal": "SIGTERM",
  "gracePeriodSec": 10
}
```

Cancellation flow:

```text
RUNNING → CANCELLING → CANCELLED
```

Timeout flow:

```text
RUNNING → TIMEOUT → RETRYING or DEAD_LETTER
```

---

## 21. Job Leases and Stuck Job Detection

To avoid lost jobs, each assigned job should have a lease.

### Lease Flow

```text
Worker receives job lease for 60 seconds.
Worker renews lease while job is running.
If lease expires, master marks job as STUCK.
Stuck job is requeued or marked failed based on policy.
```

### Benefits

- Handles worker crashes
- Handles network failures
- Prevents jobs from disappearing
- Enables automatic recovery

---

## 22. Retry Strategy

### Default Retry Policy

- Max retries: 3
- Backoff: exponential
- Retry only if error is retryable
- Preserve failure reason

### Retry Flow

```text
Fail → Retry Queue → Reassign → Execute
```

### Dead Letter Flow

```text
FAILED → RETRYING → FAILED → RETRYING → DEAD_LETTER
```

### Dead Letter Queue Features

Dead letter jobs can be:

- Inspected
- Retried manually
- Cloned into a new job
- Exported for debugging
- Linked to logs and artifacts

---

## 23. Pipeline and Dependency System

Nebula should eventually support job pipelines.

Example:

```text
crawl website → extract links → scan URLs → generate report → upload PDF
```

### Pipeline Fields

Jobs should support:

```text
parent_job_id
pipeline_id
depends_on
stage_name
stage_order
```

### Pipeline States

- `PENDING`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `PARTIALLY_FAILED`
- `CANCELLED`

---

## 24. Communication Protocols

### REST APIs

Used for:

- Registration
- Authentication
- Configuration
- Job creation
- Provider account management
- Secrets management
- Artifact metadata

### WebSockets

Used for:

- Realtime logs
- Live metrics
- Status updates
- Job progress
- Dashboard updates

### Redis Pub/Sub

Used for:

- Queue distribution
- Internal events
- Scheduler notifications

### Optional gRPC

Future option for efficient worker communication.

---

## 25. WebSocket Event Design

### Server to Dashboard Events

```text
worker:registered
worker:heartbeat
worker:online
worker:offline
worker:status_changed
worker:draining
job:created
job:assigned
job:started
job:progress
job:log
job:completed
job:failed
job:retrying
job:cancelled
job:timeout
queue:updated
metrics:updated
provider_account:status_changed
```

### Worker to Server Events

```text
worker:connect
worker:heartbeat
worker:log
worker:metrics
job:started
job:progress
job:completed
job:failed
job:lease_renewed
artifact:uploaded
```

---

## 26. API Versioning

All public APIs should be versioned.

Use:

```http
/api/v1/workers/register
/api/v1/jobs
/api/v1/metrics
/api/v1/provider-accounts
```

Avoid unversioned APIs like:

```http
/api/workers/register
```

---

## 27. API Endpoints

## Worker APIs

### Register Worker

```http
POST /api/v1/workers/register
```

### Send Heartbeat

```http
POST /api/v1/workers/heartbeat
```

### Fetch Tasks

```http
GET /api/v1/tasks
```

### Submit Result

```http
POST /api/v1/tasks/result
```

### Renew Job Lease

```http
POST /api/v1/jobs/:jobId/lease/renew
```

### Submit Logs

```http
POST /api/v1/jobs/:jobId/logs
```

### Submit Progress

```http
POST /api/v1/jobs/:jobId/progress
```

## Job APIs

### Create Job

```http
POST /api/v1/jobs
```

### List Jobs

```http
GET /api/v1/jobs
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

### Reprioritize Job

```http
POST /api/v1/jobs/:jobId/priority
```

## Provider Account APIs

```http
POST /api/v1/provider-accounts
GET /api/v1/provider-accounts
GET /api/v1/provider-accounts/:id
PATCH /api/v1/provider-accounts/:id
POST /api/v1/provider-accounts/:id/rotate-credentials
POST /api/v1/provider-accounts/:id/disable
```

## Worker Pool APIs

```http
POST /api/v1/worker-pools
GET /api/v1/worker-pools
PATCH /api/v1/worker-pools/:id
DELETE /api/v1/worker-pools/:id
```

## Webhook APIs

```http
POST /api/v1/webhooks
GET /api/v1/webhooks
PATCH /api/v1/webhooks/:id
DELETE /api/v1/webhooks/:id
```

---

## 28. Idempotency

Job creation APIs should support idempotency keys.

Example:

```http
POST /api/v1/jobs
Idempotency-Key: abc123
```

If the same key is reused, the API should return the existing job instead of creating a duplicate.

This is important for:

- Automation
- API retries
- Webhook-based submissions
- Network failures

---

## 29. Authentication and Security

### Dashboard Authentication

Users authenticate using:

- JWT
- Session tokens
- API keys
- Optional SSO in future

### Worker Authentication

Each worker receives:

- Worker token
- API secret
- Optional scoped credentials

### Security Features

- Rate limiting
- HTTPS
- Encrypted secrets
- Token expiration
- Token rotation
- IP validation
- Request validation
- Scoped worker permissions
- Signed job payloads
- Audit logs
- Secret masking in logs
- Optional mTLS in future

### Worker Trust Levels

Workers should have trust levels:

```text
trusted
semi_trusted
untrusted
ephemeral
local
```

Sensitive jobs should only run on trusted workers.

Example:

```json
{
  "requiresTrustLevel": "trusted"
}
```

### Untrusted Execution Warning

Arbitrary shell/script execution is dangerous. Untrusted code should run only inside sandboxed or Docker-isolated environments.

---

## 30. Secrets Management

Workers may need:

- API keys
- Cookies
- Tokens
- Proxy credentials
- Environment variables
- Cloud credentials

Secrets should be:

- Encrypted at rest
- Scoped to organization, project, provider account, worker, pool, or job
- Never displayed after creation
- Injected only into authorized workers
- Rotatable
- Masked in logs

Example:

```json
{
  "name": "OPENAI_API_KEY",
  "scope": "project",
  "availableTo": ["worker-tag:ai"]
}
```

Secret scopes:

```text
organization
project
provider_account
worker_pool
worker
job
```

---

## 31. Artifact Storage

Many jobs produce files.

Examples:

- Screenshots
- Scan reports
- Rendered PDFs
- Scraped datasets
- Logs
- Generated images
- Exported JSON
- Compressed archives

### Storage Backends

MVP:

- Local disk

Future:

- S3
- Cloudflare R2
- MinIO
- Backblaze B2
- Oracle Object Storage

### Result Types

```text
inline result
JSON result
file artifact
external URL
compressed archive
```

Example:

```json
{
  "resultType": "artifact",
  "artifactId": "artifact_123"
}
```

Large results should not be stored directly in PostgreSQL.

---

## 32. Realtime Monitoring

### Metrics Collected

#### System Metrics

- CPU usage
- RAM usage
- Network traffic
- Disk usage
- Uptime

#### Queue Metrics

- Pending jobs
- Running jobs
- Completed jobs
- Failed jobs
- Retries
- Queue latency
- Dead letter count

#### Worker Metrics

- Active workers
- Inactive workers
- Busy workers
- Task throughput
- Active job count
- Average runtime

#### Provider Account Metrics

- Workers per account
- Runtime per account
- Jobs per account
- Failure rate per account
- Estimated usage

---

## 33. Observability

### Prometheus Metrics

```text
nebula_workers_online
nebula_workers_offline
nebula_jobs_queued
nebula_jobs_running
nebula_jobs_completed_total
nebula_jobs_failed_total
nebula_job_duration_seconds
nebula_worker_cpu_usage
nebula_worker_memory_usage
nebula_queue_latency_seconds
nebula_scheduler_assignments_total
nebula_provider_account_rate_limited_total
nebula_dead_letter_jobs_total
```

### Logs to Track

- Request logs
- Worker reconnect logs
- Scheduler decision logs
- Retry logs
- Webhook delivery logs
- Audit logs
- Error logs

---

## 34. Logging System

### Log Types

| Type | Meaning |
|---|---|
| `INFO` | Normal operations |
| `WARNING` | Potential issues |
| `ERROR` | Critical failures |
| `DEBUG` | Development/debug logs |

### Features

- Realtime streaming
- Filtering
- Searching
- Export support
- Secret masking
- Log severity
- Worker/job mapping

### Log Retention Policy

Logs can grow quickly. Support:

- 7-day retention
- 30-day retention
- 90-day retention
- Custom retention
- Max log size per job
- Max logs per minute
- Automatic cleanup
- Log export

---

## 35. Webhooks

Nebula should support outgoing webhooks for important events.

### Webhook Events

```text
job.created
job.started
job.completed
job.failed
job.timeout
job.cancelled
worker.online
worker.offline
worker.error
queue.overloaded
provider_account.rate_limited
```

### Webhook Features

- Event selection
- Signing secret
- Retry delivery
- Delivery logs
- Disable failing webhooks
- Test webhook button

Example:

```json
{
  "event": "job.completed",
  "url": "https://yourapp.com/webhook"
}
```

---

## 36. Notifications

Nebula should support alerts through:

- Email
- Discord webhook
- Slack webhook
- Telegram bot
- Generic webhook

Notify when:

- Worker offline
- Job failed
- Queue stuck
- Provider account rate-limited
- High failure rate
- Redis unavailable
- Storage unavailable
- Secret rotation required

---

## 37. Failure Handling

### Worker Failure

If heartbeat timeout occurs:

- Mark worker offline
- Detect running leases
- Requeue unfinished jobs
- Mark affected jobs as retrying or stuck

### Job Failure

Retry based on retry policy.

### Redis Failure

- Reconnect automatically
- Pause job intake if needed
- Alert admins

### Master Failure

- Persist queue state
- Recover workers through reconnect logic
- Resume scheduling after restart

### Provider Account Failure

If account is rate-limited, auth failed, or degraded:

- Mark account status
- Avoid scheduling new jobs to it
- Notify admins

---

## 38. Backpressure

When the system is overloaded, it should slow down or reject new jobs.

Rules:

```text
if queue_size > limit → reject or delay new jobs
if Redis memory high → pause intake
if workers offline → delay low-priority jobs
if failure rate high → pause affected job type
if provider account rate-limited → avoid that account
```

Backpressure prevents the platform from crashing under load.

---

## 39. Rate Limits

Rate limit:

- Login attempts
- Job creation
- Worker registration
- Heartbeats
- Log streaming
- API key usage
- Webhook creation
- Artifact uploads

Rate limits should be configurable per organization and project.

---

## 40. Audit Logs

Audit logs should track:

- Who created a job
- Who deleted a worker
- Who rotated a token
- Who viewed secret metadata
- Who changed retry settings
- Who disabled an account
- Who triggered emergency controls
- Who changed project quotas

Example table:

```text
audit_logs
 ├── id
 ├── organization_id
 ├── actor_user_id
 ├── action
 ├── target_type
 ├── target_id
 ├── ip_address
 ├── user_agent
 ├── metadata
 ├── created_at
```

---

## 41. Admin Emergency Controls

Admin should be able to:

- Pause all queues
- Resume all queues
- Disable provider account
- Disable worker
- Drain worker
- Kill job
- Requeue stuck jobs
- Rotate all worker tokens
- Enable maintenance mode
- Disable job type temporarily

---

## 42. Worker Versioning and Updates

Track:

```text
worker_version
agent_version
protocol_version
supported_features
```

Example:

```json
{
  "workerVersion": "0.3.1",
  "protocolVersion": "v1",
  "features": ["logs", "metrics", "docker"]
}
```

### Auto-Update Strategy

Support:

- Manual update
- Auto-update
- Update available alert
- Rolling update
- Drain before update

Flow:

```text
Mark draining → finish jobs → update worker → reconnect → online
```

---

## 43. Cost Awareness

Since the system may use multiple provider accounts, add rough cost and usage tracking.

Track:

- Jobs per provider
- Runtime per provider
- Worker uptime
- Estimated cost
- Free-tier usage
- Provider limits

Dashboard examples:

```text
Render Account 1: 80% free-tier usage
Oracle VPS: 120 CPU-hours used
Railway: near monthly limit
```

---

## 44. Database Design

## users

Stores:

```text
id
email
password_hash
name
role
created_at
updated_at
```

## organizations

```text
id
name
slug
plan
created_at
updated_at
```

## organization_members

```text
id
organization_id
user_id
role
created_at
updated_at
```

## projects

```text
id
organization_id
name
slug
description
quota_config
created_by
created_at
updated_at
```

## provider_accounts

```text
id
organization_id
provider
account_name
credentials_encrypted
region
status
limits
created_by
created_at
updated_at
```

## worker_pools

```text
id
organization_id
project_id
name
description
allowed_job_types
required_trust_level
created_at
updated_at
```

## workers

```text
id
organization_id
project_id
provider_account_id
worker_pool_id
node_id
name
provider
region
status
trust_level
capabilities
cpu_cores
memory_mb
max_concurrent_jobs
active_jobs
worker_version
protocol_version
last_heartbeat_at
registered_at
created_at
updated_at
```

## worker_heartbeats

```text
id
worker_id
cpu_usage
memory_usage
network_rx
network_tx
active_jobs
uptime_sec
received_at
```

## jobs

```text
id
organization_id
project_id
type
status
priority
payload
requirements
result
error
attempts
max_attempts
assigned_worker_id
provider_account_id
worker_pool_id
pipeline_id
parent_job_id
timeout_sec
lease_expires_at
idempotency_key
queued_at
started_at
completed_at
failed_at
created_by
created_at
updated_at
```

## job_logs

```text
id
organization_id
project_id
job_id
worker_id
level
message
timestamp
metadata
created_at
```

## metrics

```text
id
organization_id
project_id
worker_id
job_id
metric_name
metric_value
metadata
created_at
```

## artifacts

```text
id
organization_id
project_id
job_id
worker_id
filename
mime_type
size
storage_provider
storage_url
checksum
created_at
```

## secrets

```text
id
organization_id
project_id
scope
scope_id
name
value_encrypted
created_by
created_at
updated_at
rotated_at
```

## webhooks

```text
id
organization_id
project_id
url
events
secret_encrypted
status
created_at
updated_at
```

## webhook_deliveries

```text
id
webhook_id
event
payload
status
attempts
last_error
created_at
updated_at
```

## audit_logs

```text
id
organization_id
actor_user_id
action
target_type
target_id
ip_address
user_agent
metadata
created_at
```

---

## 45. Multi-Tenant Design

Even if MVP is single-user, tables should include:

```text
organization_id
project_id
created_by
updated_by
```

This avoids painful migrations later.

Access control should be enforced at:

- Organization level
- Project level
- Provider account level
- Worker pool level
- Secret level
- API key level

---

## 46. Dashboard Features

### Cluster Overview

- Worker count
- Active tasks
- Queue size
- Utilization
- Provider account health
- Recent alerts

### Worker Control

- Restart worker
- Drain worker
- Disable worker
- Move worker to pool
- Change trust level

### Task Controls

- Cancel jobs
- Retry jobs
- Reprioritize jobs
- Clone jobs
- Move failed jobs from dead letter queue

### Provider Account Control

- Add account
- Disable account
- Rotate credentials
- Set limits
- View usage

### Project Control

- Create project
- Set quotas
- Manage project workers
- Manage project secrets

---

## 47. Deployment Strategy

### Master Deployment

Recommended:

- VPS
- Oracle Cloud
- Railway
- Render Paid
- Docker Compose

### Worker Deployment

Workers may run on:

- Multiple Render accounts
- Docker containers
- Local machines
- VPS providers
- Cloud VMs
- Railway
- Oracle Cloud

### MVP Deployment Setup

Use Docker Compose for:

- API server
- PostgreSQL
- Redis
- Worker sample
- Dashboard

---

## 48. Recommended Folder Structure

## Monorepo

```text
nebula-cluster/
 ├── apps/
 │    ├── api/
 │    ├── dashboard/
 │    └── worker/
 ├── packages/
 │    ├── shared/
 │    ├── sdk-js/
 │    ├── worker-sdk/
 │    └── config/
 ├── docker/
 ├── docs/
 └── scripts/
```

## API Server

```text
apps/api/
 ├── controllers/
 ├── routes/
 ├── websocket/
 ├── queue/
 ├── scheduler/
 ├── workers/
 ├── middleware/
 ├── services/
 ├── database/
 ├── modules/
 │    ├── auth/
 │    ├── jobs/
 │    ├── workers/
 │    ├── projects/
 │    ├── provider-accounts/
 │    ├── secrets/
 │    ├── webhooks/
 │    └── audit/
 └── utils/
```

## Worker

```text
apps/worker/
 ├── jobs/
 ├── services/
 ├── metrics/
 ├── websocket/
 ├── executors/
 │    ├── function-executor.ts
 │    ├── shell-executor.ts
 │    ├── docker-executor.ts
 │    └── http-executor.ts
 └── utils/
```

---

## 49. CLI Tool

A CLI should eventually be added.

Example commands:

```bash
nebula login
nebula workers list
nebula jobs create --type scrape_url --payload payload.json
nebula jobs logs job_123
nebula worker drain worker-1
nebula deploy worker --provider render
```

CLI is not required for MVP but is useful for developer adoption.

---

## 50. SDK

Provide SDKs for programmatic job submission.

### JavaScript/TypeScript SDK

```js
await nebula.jobs.create({
  type: "scrape_url",
  payload: { url: "https://example.com" }
});
```

### Future SDKs

- Python
- Go

---

## 51. Scaling Strategy

### Horizontal Worker Scaling

Add more workers across providers/accounts.

### Queue Scaling

Redis supports distributed consumers.

### Master Scaling

Future support:

- Load balancers
- Multiple API replicas
- Shared Redis
- Shared PostgreSQL
- WebSocket scaling with Redis adapter

### Scheduler Scaling

Scheduler should initially be single-active-instance to avoid duplicate assignment.

Future improvement:

- Leader election
- Distributed locks
- Partitioned queues

---

## 52. MVP Scope

### Phase 1 — Core MVP

Build first:

- Master API server
- PostgreSQL schema
- Redis + BullMQ queue
- Worker registration
- Heartbeat tracking
- Simple worker SDK/runtime
- Job creation API
- Job polling/execution
- Basic dashboard overview
- Worker list
- Job list
- Basic logs

### Phase 2 — Reliability

Add:

- Realtime logs
- WebSocket updates
- Retries
- Metrics
- Timeout handling
- Job leases
- Stuck job detection
- Dead letter queue

### Phase 3 — Multi-Account and Projects

Add:

- Organizations
- Projects
- Provider accounts
- Worker pools
- Secrets
- Account-aware scheduling
- Audit logs

### Phase 4 — Advanced Execution

Add:

- Docker jobs
- Artifact storage
- Pipeline system
- Webhooks
- Notifications
- CLI
- SDK

### Phase 5 — Advanced Scaling

Add:

- Autoscaling
- Provider deployment automation
- Cost awareness
- Plugin system
- Kubernetes integration
- Distributed storage

---

## 53. Features to Avoid in MVP

Avoid initially:

- Full plugin system
- Autoscaling
- Kubernetes integration
- Distributed storage
- Advanced provider analytics
- AI workload optimization
- Complex pipeline DAGs
- Full sandbox system
- Multi-region active-active master

---

## 54. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Free-tier instability | Render/Railway workers may sleep | Heartbeat timeout, requeue jobs |
| Rate limits | Providers may limit excessive usage | Account-aware scheduling, rate-limit detection |
| Network latency | Public internet communication adds delay | Async queues, retries, timeouts |
| Worker reliability | Workers may disconnect unexpectedly | Heartbeats, leases, reconnect logic |
| Untrusted code execution | Arbitrary code can be dangerous | Docker sandboxing, permissions, restrictions |
| Worker spoofing | Fake workers may register | Signed tokens, token rotation, mTLS later |
| Queue overload | Too many jobs can overload Redis/workers | Backpressure, limits, quotas |
| Log flooding | Workers can spam logs | Log limits, sampling, retention |
| Secret leakage | Secrets may leak in logs | Secret masking, encrypted storage |
| Long-running jobs | Can block worker capacity | Timeout, cancellation, concurrency limits |
| Master outage | Scheduling may stop | Persistent queues, restart recovery |
| Storage growth | Logs/artifacts may grow fast | Retention and cleanup policies |

---

## 55. Success Metrics

### Technical Metrics

- Worker uptime
- Queue throughput
- Average job latency
- Failure rate
- Retry success rate
- Queue wait time
- Worker reconnect rate
- Dead letter count
- Scheduler assignment success rate

### Product Metrics

- Total active workers
- Jobs processed
- Concurrent workloads
- Active projects
- Active provider accounts
- API usage
- Dashboard usage

---

## 56. Recommended Tech Stack

### Frontend

- React
- TailwindCSS
- Socket.IO Client
- React Query
- Recharts

### Backend

- Node.js
- Express.js or Fastify
- Prisma or Drizzle

### Queue

- Redis
- BullMQ

### Database

- PostgreSQL

### Realtime

- Socket.IO

### Monitoring

- Prometheus
- Grafana

### Storage

MVP:

- Local disk

Future:

- S3-compatible object storage
- Cloudflare R2
- MinIO

### Deployment

- Docker Compose for MVP
- VPS or cloud VM for master
- Docker workers across providers

---

## 57. Final Vision

Nebula Cluster should evolve into:

- A lightweight orchestration platform
- A distributed compute framework
- A scalable worker execution system
- A realtime infrastructure dashboard
- A multi-provider worker control plane
- A practical alternative for small-scale distributed task execution

The platform should emphasize:

- Simplicity
- Extensibility
- Distributed reliability
- Realtime orchestration
- Multi-provider compatibility
- Account-aware scheduling
- Secure execution
- Strong observability

Nebula Cluster should remain lightweight enough for:

- Students
- Developers
- Hobbyists
- Security researchers
- Independent infrastructure projects
- Small engineering teams

while still being structured cleanly enough to grow into a serious orchestration platform.

---

## 58. Highest Priority Additions

The most important additions to implement early are:

```text
1. Projects
2. Provider accounts
3. Worker pools
4. Worker capability matching
5. Account-aware scheduling
6. Job leases
7. Stuck job detection
8. Idempotency keys
9. Audit logs
10. Log retention
11. Dead letter queue
12. Secrets management
13. Artifact storage
14. Webhooks
15. Worker versioning
```

These additions will prevent major redesign later.

