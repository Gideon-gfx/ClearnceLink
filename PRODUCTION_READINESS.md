# ClearanceLink production readiness

The API now rejects oversized requests, limits concurrent requests and sensitive actions, restricts browser origins, uses security response headers, and hashes passwords without blocking the event loop. Student and staff directory screens request bounded pages. These protections reduce common failure and abuse paths; they do not establish a capacity rating or make the service immune to compromise.

## Before a public deployment

1. Run the API with `NODE_ENV=production`, a managed `MONGODB_URI`, and `CORS_ALLOWED_ORIGINS` containing only the exact production website origin(s). Production startup refuses local JSON storage. Serve the API over HTTPS behind a trusted reverse proxy. Set `TRUST_PROXY=1` only when that proxy removes client supplied forwarding headers and supplies the real client address.
2. Store credentials in the host's secret manager. Use production keys for email, payments and file storage. Restrict database and storage network access and permissions. Enable automated backups with a restore procedure. Set the correct public payment callback and webhook URLs.
3. Use a provider with autoscaling, request limits and DDoS protection at the edge. Monitor request latency, error rate, CPU, memory, database connections, queue length, email delivery and payment webhooks. Configure alerts and a rollback process.
4. Remove the in-memory data snapshot design in `server/store.js` before running more than one API replica or claiming large scale. It loads whole collections on startup, scans them on writes, and each replica can hold stale data. Move handlers to indexed database queries and atomic updates, including sessions, OTPs, submissions and audit records. Add pagination to all growing collection endpoints. Move email, reminders and large imports to durable background jobs with retry and idempotency. Benchmark with expected record counts and traffic patterns, then size hosting from measured latency and throughput.
5. Before launch, arrange an independent security review of authentication, tenant boundaries, document access, payments and webhooks. Keep dependencies updated and review alerts. Practice backup restoration and incident response.

## Current operational limit

There is no deployed API or load measurement. The current storage design is suitable for development and a controlled pilot on one API process. It is **not** ready to promise thousands or millions of simultaneous users. Request limits may need tuning for universities where many users share one public IP address.
