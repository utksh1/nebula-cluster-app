# Nebula Cluster — Security Model

## 1. Security Goals

Nebula Cluster must protect:

- Dashboard users
- API keys
- Worker tokens
- Provider account credentials
- Secrets
- Job payloads
- Job results
- Logs
- Artifacts
- Infrastructure resources

---

## 2. Authentication

### Dashboard Authentication

Use:

- Email/password login
- Password hashing with bcrypt or argon2
- JWT access tokens
- Refresh tokens or secure sessions

### API Authentication

Use API keys for external integrations.

Store only hashed API keys.

### Worker Authentication

Each worker should authenticate with a worker token.

Worker tokens should be:

- Unique per worker or worker group
- Rotatable
- Scoped to organization/project/provider account
- Revocable

---

## 3. Authorization

Use role-based access control.

Recommended roles:

```text
OWNER
ADMIN
DEVELOPER
VIEWER
```

Example permissions:

| Action | Owner | Admin | Developer | Viewer |
|---|---:|---:|---:|---:|
| Manage organization | Yes | No | No | No |
| Manage provider accounts | Yes | Yes | No | No |
| Create jobs | Yes | Yes | Yes | No |
| View jobs | Yes | Yes | Yes | Yes |
| View secrets | Limited | Limited | No | No |
| Rotate tokens | Yes | Yes | No | No |
| Disable workers | Yes | Yes | No | No |

---

## 4. Secrets Management

Secrets should be:

- Encrypted at rest
- Scoped to organization/project/provider account/worker/job
- Never returned after creation
- Masked in logs
- Rotatable
- Audited when created, updated, or used

Secret values should not be stored in plaintext.

---

## 5. Worker Trust Levels

Workers should have trust levels:

```text
trusted
semi_trusted
untrusted
ephemeral
local
```

Sensitive jobs should require trusted workers.

Example:

```json
{
  "requiresTrustLevel": "trusted"
}
```

---

## 6. Job Execution Security

Running arbitrary code is dangerous.

### MVP Recommendation

Only allow predefined job handlers and safe HTTP jobs.

Avoid arbitrary shell execution unless:

- Worker is trusted
- Commands are restricted
- Timeout is enforced
- Logs are sanitized
- Secrets are masked

### Docker Execution Recommendation

Use Docker/sandbox execution for untrusted code.

Controls:

- CPU limits
- Memory limits
- Disk limits
- Network restrictions
- Read-only filesystem if possible
- Timeout enforcement
- No privileged containers
- No host Docker socket exposure

---

## 7. Request Validation

Use Zod or similar validation for every API request.

Validate:

- Required fields
- Payload size
- Job type
- Allowed provider/account/project
- Timeout limits
- Retry limits
- Webhook URLs
- Secret names

---

## 8. Rate Limiting

Rate limit:

- Login attempts
- Job creation
- Worker registration
- Heartbeats
- Log ingestion
- Webhook creation
- API key usage

---

## 9. Audit Logs

Audit these actions:

- User login
- Job creation/cancellation/retry
- Worker drain/disable/delete
- Provider account create/update/delete
- Secret create/update/rotate/delete
- API key create/delete
- Queue pause/resume
- Settings changes

Audit log fields:

```text
actor
organization
project
action
target_type
target_id
ip_address
user_agent
metadata
created_at
```

---

## 10. Webhook Security

Webhook deliveries should be signed.

Use header:

```http
X-Nebula-Signature: sha256=...
```

Webhook receivers can verify the payload using the webhook secret.

Add retry limits to webhook delivery.

---

## 11. Log Safety

Logs can leak secrets.

Controls:

- Secret masking
- Max log size per job
- Max logs per minute
- Retention policy
- Disable DEBUG logs in production by default

---

## 12. Network Security

Recommended:

- HTTPS everywhere
- Secure cookies if using sessions
- CORS allowlist
- Helmet middleware
- IP allowlist option for workers
- Optional mTLS in future

---

## 13. Emergency Controls

Add admin controls:

- Pause all queues
- Disable provider account
- Disable worker
- Kill job
- Rotate all worker tokens
- Requeue stuck jobs
- Maintenance mode

---

## 14. Security Non-Negotiables

Do not:

- Store raw API keys
- Return secret values after creation
- Run untrusted code on the host
- Expose the Docker socket to jobs
- Let untrusted workers access sensitive secrets
- Allow unlimited logs or unlimited job runtime
