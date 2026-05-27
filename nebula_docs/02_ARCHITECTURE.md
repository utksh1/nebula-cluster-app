# Nebula Cluster — System Architecture

## 1. Architecture Goal

Nebula Cluster should be a lightweight distributed worker orchestration platform with a centralized control plane and many distributed workers.

It should support:

- Multi-provider workers
- Multiple provider accounts
- Projects
- Worker pools
- Queue-based job execution
- Realtime logs and metrics
- Secure worker authentication
- Job retries, leases, and stuck-job recovery

---

## 2. High-Level Architecture

```text
                           Web Dashboard
                                |
                                v
                          API Gateway/Auth
                                |
                                v
                         Control Plane API
                                |
        -------------------------------------------------
        |                    |                          |
   PostgreSQL              Redis                  WebSocket Hub
        |                    |                          |
        |              BullMQ Queues                    |
        |                    |                          |
        -------------------------------------------------
                                |
                                v
                         Scheduler Service
                                |
          ------------------------------------------------
          |              |              |                |
      Worker Node    Worker Node    Worker Node     Worker Node
      Render         Oracle VPS     Railway         Local Docker
          |              |              |                |
          ------------------------------------------------
                                |
                                v
                    Logs / Metrics / Artifacts
```

---

## 3. Control Plane

The control plane manages the platform.

Responsibilities:

- User authentication
- Organization and project management
- Provider account management
- Worker registration
- Worker heartbeat validation
- Worker pool management
- Job creation
- Queue management
- Scheduling decisions
- Retry handling
- Job lease tracking
- Logs and metrics aggregation
- Artifact metadata
- Secrets management
- Webhooks and notifications
- Audit logging

---

## 4. Data Plane

The data plane executes work.

Responsibilities:

- Worker execution
- Runtime metrics collection
- Log streaming
- Job progress reporting
- Artifact upload
- Result reporting
- Reconnect handling
- Job cancellation handling
- Drain mode handling

---

## 5. Core Hierarchy

```text
Organization
 └── Project
      ├── Provider Accounts
      ├── Worker Pools
      │    └── Workers
      ├── Queues
      ├── Jobs
      ├── Logs
      ├── Metrics
      ├── Artifacts
      ├── Secrets
      ├── Webhooks
      └── Audit Logs
```

---

## 6. Communication Flow

### Worker Startup Flow

```text
Worker starts
 → loads config
 → sends registration request
 → master validates token
 → worker is stored/updated
 → worker opens websocket connection
 → worker starts heartbeat loop
 → worker becomes ONLINE
```

### Job Execution Flow

```text
User/API creates job
 → API validates request
 → job stored in PostgreSQL
 → job added to BullMQ queue
 → scheduler filters eligible workers
 → worker receives/pulls job
 → job lease is created
 → worker executes job
 → logs/progress stream to master
 → result/artifacts uploaded
 → job marked COMPLETED or FAILED
```

### Worker Failure Flow

```text
Worker misses heartbeat
 → worker marked OFFLINE
 → active job leases expire
 → unfinished jobs become STALE
 → eligible jobs are requeued
 → dashboard receives worker:offline event
```

---

## 7. Scheduling Architecture

The scheduler should be separate logically, even if it runs inside the API process in MVP.

Scheduling inputs:

- Job priority
- Job requirements
- Worker status
- Worker capacity
- Worker capabilities
- Worker pool
- Provider account
- Region
- Trust level
- Account limits
- Project limits
- Organization quotas

MVP scheduling rule:

```text
1. Find ONLINE workers
2. Exclude DRAINING, DISABLED, OFFLINE, ERROR workers
3. Filter by organization and project
4. Filter by worker pool if required
5. Filter by job capabilities
6. Filter by provider/provider account/region if specified
7. Filter by trust level
8. Check account/project concurrency limits
9. Pick least-loaded worker
10. Tie-break by lowest CPU usage
```

---

## 8. Realtime Architecture

Use Socket.IO for realtime communication.

### Dashboard Events

- `worker:registered`
- `worker:heartbeat`
- `worker:online`
- `worker:offline`
- `worker:status_changed`
- `job:created`
- `job:assigned`
- `job:started`
- `job:progress`
- `job:log`
- `job:completed`
- `job:failed`
- `queue:updated`
- `metrics:updated`

### Worker Events

- `worker:connect`
- `worker:heartbeat`
- `worker:metrics`
- `worker:log`
- `job:started`
- `job:progress`
- `job:completed`
- `job:failed`

---

## 9. Deployment Architecture

### MVP Deployment

```text
VPS / Main Server
 ├── api container
 ├── dashboard container
 ├── postgres container or managed postgres
 ├── redis container or managed redis
 └── reverse proxy

External Workers
 ├── Render workers
 ├── Railway workers
 ├── Oracle Cloud workers
 ├── Docker VPS workers
 └── local workers
```

### Future Deployment

```text
Load Balancer
 ├── API Replica 1
 ├── API Replica 2
 ├── WebSocket Service
 ├── Scheduler Service
 ├── Managed Redis
 ├── Managed PostgreSQL
 └── Object Storage
```

---

## 10. Reliability Patterns

Use these reliability mechanisms:

- Heartbeats
- Reconnect with exponential backoff
- Job leases
- Lease renewal
- Stuck job detection
- Dead letter queue
- Retry policies
- Worker drain mode
- Idempotency keys
- Queue backpressure
- Log rate limiting
- Graceful shutdown

---

## 11. Security Boundaries

Security should separate:

- Dashboard users
- API clients
- Worker agents
- Provider accounts
- Secrets
- Jobs
- Artifacts

Untrusted code should only run in Docker/sandboxed environments.
