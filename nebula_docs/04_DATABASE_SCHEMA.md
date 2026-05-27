# Nebula Cluster — Database Schema Design

## 1. Database

Recommended database: PostgreSQL

Recommended ORM: Prisma

Use UUID/CUID-style IDs for public objects.

---

## 2. Core Tables

### users

```text
id
email
password_hash
name
role
status
last_login_at
created_at
updated_at
```

### organizations

```text
id
name
slug
owner_user_id
plan
status
created_at
updated_at
```

### organization_members

```text
id
organization_id
user_id
role
created_at
updated_at
```

Roles:

```text
OWNER
ADMIN
DEVELOPER
VIEWER
```

---

## 3. Projects

### projects

```text
id
organization_id
name
slug
description
status
created_by
created_at
updated_at
```

---

## 4. Provider Accounts

### provider_accounts

```text
id
organization_id
project_id nullable
provider
account_name
credentials_encrypted
region
status
limits_json
created_by
created_at
updated_at
```

Provider account statuses:

```text
CONNECTED
DISCONNECTED
AUTH_FAILED
RATE_LIMITED
DISABLED
DEGRADED
```

---

## 5. Worker Pools

### worker_pools

```text
id
organization_id
project_id
name
slug
description
allowed_job_types_json
min_trust_level
limits_json
created_at
updated_at
```

---

## 6. Workers

### workers

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
capabilities_json
tags_json
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

Worker statuses:

```text
ONLINE
OFFLINE
BUSY
ERROR
DRAINING
DISABLED
```

Trust levels:

```text
trusted
semi_trusted
untrusted
ephemeral
local
```

---

## 7. Worker Heartbeats

### worker_heartbeats

```text
id
worker_id
cpu_usage
memory_usage
network_rx
network_tx
active_jobs
uptime_sec
raw_metrics_json
received_at
```

For MVP, store recent heartbeats only. Add retention cleanup.

---

## 8. Jobs

### jobs

```text
id
organization_id
project_id
queue_name
pipeline_id nullable
parent_job_id nullable
created_by
type
status
priority
payload_json
requirements_json
placement_json
result_json
error_json
attempts
max_attempts
backoff_strategy
assigned_worker_id nullable
worker_pool_id nullable
provider_account_id nullable
idempotency_key nullable
timeout_sec
lease_expires_at nullable
queued_at
started_at
completed_at
failed_at
cancelled_at
created_at
updated_at
```

Job statuses:

```text
QUEUED
ASSIGNED
RUNNING
COMPLETED
FAILED
RETRYING
CANCELLING
CANCELLED
TIMEOUT
STALE
DEAD_LETTER
```

---

## 9. Job Attempts

### job_attempts

```text
id
job_id
worker_id
attempt_number
status
started_at
completed_at
failed_at
error_json
created_at
updated_at
```

This helps debug retry behavior.

---

## 10. Job Leases

### job_leases

```text
id
job_id
worker_id
lease_token
status
expires_at
renewed_at
created_at
updated_at
```

Lease statuses:

```text
ACTIVE
EXPIRED
RELEASED
CANCELLED
```

---

## 11. Logs

### job_logs

```text
id
organization_id
project_id
job_id
worker_id
level
message
metadata_json
timestamp
created_at
```

Log levels:

```text
DEBUG
INFO
WARNING
ERROR
```

### worker_logs

```text
id
organization_id
project_id
worker_id
level
message
metadata_json
timestamp
created_at
```

---

## 12. Metrics

### worker_metrics

```text
id
worker_id
cpu_usage
memory_usage
network_rx
network_tx
active_jobs
uptime_sec
created_at
```

### queue_metrics

```text
id
organization_id
project_id
queue_name
queued_jobs
running_jobs
completed_jobs
failed_jobs
retrying_jobs
queue_latency_ms
created_at
```

---

## 13. Artifacts

### artifacts

```text
id
organization_id
project_id
job_id
worker_id
filename
mime_type
size_bytes
storage_provider
storage_key
storage_url nullable
checksum
created_at
```

Do not store large files directly in PostgreSQL.

---

## 14. Secrets

### secrets

```text
id
organization_id
project_id nullable
provider_account_id nullable
name
scope
value_encrypted
available_to_json
created_by
rotated_at
created_at
updated_at
```

Secret scopes:

```text
organization
project
provider_account
worker
job
```

---

## 15. API Keys

### api_keys

```text
id
organization_id
project_id nullable
name
key_hash
scopes_json
last_used_at
expires_at
created_by
created_at
updated_at
```

Never store raw API keys.

---

## 16. Webhooks

### webhooks

```text
id
organization_id
project_id
url
events_json
secret_hash
status
created_by
created_at
updated_at
```

### webhook_deliveries

```text
id
webhook_id
event_type
payload_json
status
response_status
response_body
attempts
next_retry_at
created_at
updated_at
```

---

## 17. Audit Logs

### audit_logs

```text
id
organization_id
project_id nullable
actor_user_id nullable
action
target_type
target_id
metadata_json
ip_address
user_agent
created_at
```

Examples:

```text
job.created
job.cancelled
worker.disabled
worker.drained
secret.created
secret.rotated
provider_account.disabled
queue.paused
```

---

## 18. Pipelines

### pipelines

```text
id
organization_id
project_id
name
definition_json
status
created_by
created_at
updated_at
```

### pipeline_runs

```text
id
pipeline_id
status
started_at
completed_at
failed_at
created_by
created_at
updated_at
```

---

## 19. Retention Tables / Cleanup

Add cleanup policies for:

- Job logs
- Worker logs
- Metrics
- Old heartbeats
- Webhook deliveries
- Completed job results

Recommended MVP defaults:

```text
job logs: 30 days
worker heartbeats: 7 days
metrics: 30 days
audit logs: 180 days
artifacts: configurable
```
