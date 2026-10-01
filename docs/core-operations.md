# Core operations and monitoring

## Implemented boundary

`GET /api/admin/operations?range=24H` is the only new protected endpoint. `handleOperations` verifies a live Core session and requires OWNER or ADMIN before any metric query. Bootstrap tokens and USER sessions are denied. Disabled accounts and expired sessions are rejected by the existing session verifier. The endpoint is read-only apart from existing session renewal and D1-backed rate-limit counters (60 requests per account per minute). All account API responses use `Cache-Control: no-store`.

`/admin` is a static public shell containing no privileged data. Loading that shell is not authorization: every sensitive read comes from the protected Worker endpoint. The existing owner-only user and AI-access API permissions remain unchanged. No new mutation endpoint or role grant is introduced.

## Data currently available

D1Store aggregates existing `users`, `sessions` and `audit_log`. Windows are 1H, 6H, 24H, 7D and 30D, half-open `[from,to)` with millisecond timestamps. Counts are computed over all matching rows, not a limited user list. Active sessions means unexpired rows belonging to ACTIVE accounts, not users currently online; it is a current count, independent of the selected historical window. Recent users means creation during the selected window.

Audit activity has 24 equal intervals and an accessible table. Login successes/failures and AI requests/gateway failures count their existing audit event types. This is recorded audit activity, not an exhaustive request, billing, completion or traffic measurement. Recent events are limited to 30 and include only allowlisted event names and timestamps. Actor IDs, target IDs, IP, detail, passwords, session identifiers, prompts and messages are not returned. Unknown event names are replaced with `OTHER_EVENT`.

Queries fail to an unavailable response rather than silently returning zero. Reads are independent queries, so a snapshot may span concurrent account activity; it is not a transactional financial report. There is no polling loop. Expensive future analytics should move to an appropriate query backend as volume grows.

## Request metadata foundation

Wrangler already enables Workers Logs and invocation logs. `worker/telemetry.ts` emits one structured `core_request` event for each API response: timestamp, service, bounded route template, allowlisted method, status, response-header latency in milliseconds, coarse error classification and login outcome where applicable. It never reads bodies, headers or query strings; dynamic route identifiers become `:id`, unknown routes become `/api/other`. The response stream is not consumed, so SSE timing is time to response headers, not inference completion. Version is null until a real version binding/source is configured. The top-level API exception log no longer emits arbitrary exception messages.

Existing auth/mail diagnostics and Cloudflare-generated invocation logs are separate from this new redacted stream. They are not exposed by the console. Operators must review platform log access/retention and existing diagnostic behavior before a general cross-product identity rollout. In particular, the pre-existing Chat handoff puts an assertion in a redirect; do not copy its URLs into telemetry. This task does not change logging infrastructure or claim to redact Cloudflare-managed logs.

## Unavailable

There is no console query integration for request volume, error rate, latency percentiles, deployment history/version, runtime health probes, AI token/cost totals, database size/backups or query latency. The UI says unavailable, not zero. Registry availability describes release policy only; every runtime health value is unknown. Forge is a Core-hosted showcase today, not a discovered remote service.

## Deployment and schema

No schema migration, scheduled job, production query, remote probe, binding change or telemetry vendor was added. No production data is needed for tests. Unit tests use MemoryStore; SQL tests use an in-memory SQLite database with the real migrations. Isolated local browser review fixtures must use a separate local Wrangler state and a visible non-production label. They must never be deployed.

Future work: integrate a read-only bounded metrics source, deployment metadata and explicitly configured health probes, with retention, access and cost review. Keep event names and route templates low-cardinality and never store private content for debugging.

References: [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) and [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/).
