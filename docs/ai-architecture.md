# INFAIX AI architecture — main repository side

`InfaixAI` is a **separate repository/service** running on SLAB (Ollama +
RTX 4060, public endpoint `https://ai.infaix.com`). This repository
(`infaix.com`) owns **identity**; `InfaixAI` owns **inference**. The bridge
between them is defined here.

```
Browser ──session cookie──▶ Worker (/api/ai/*) ──assertion──▶ ai.infaix.com ──▶ Ollama
   │                              │                                   │
   │                              │ SSE passthrough                   │ SSE (OpenAI-compatible)
   ◀──────────── streamed reply ───┘                                   │
                                                                      ▼
                                                              InfaixAI gateway
```

The browser never learns SLAB's IP, Ollama's address, model paths, or any
gateway secret. The gateway never sees session cookies, D1, or
`SESSION_SECRET`.

## Authentication flow

1. Browser calls `POST /api/ai/chat` with the `infaix_session` cookie.
2. Worker validates the session (`verifySession`), loads the live user row.
3. Worker requires `status = ACTIVE` and AI authorization: `role = OWNER`
   bypasses, otherwise `users.ai_access = 1` (default deny — migration
   `0002_ai_access.sql`). Denials audit `AI_ACCESS_DENIED`.
4. Worker validates the request (method, JSON, 64 KB cap, ≤50 messages,
   roles, ≤8000 chars/message, ≤32000 total, logical model allowlist,
   owned `conversationId`), then rate-limits (per-user hourly + per-IP
   minutely, env-tunable).
5. Worker mints a 90-second `jose` HS256 assertion bound to the exact
   upstream request, `POST`s it to `{AI_GATEWAY_URL}/chat`, and streams the
   SSE response back with `X-Request-ID` (+ `X-Conversation-ID`).
6. A background branch persists user/assistant messages to main D1
   (`conversations`/`messages`, migration `0003_conversations.sql`) **only
   on clean `[DONE]` completion**. Ownership is always the session user.

## Assertion format (`jose`-compatible JWT, HS256)

```json
{
  "iss": "infaix-worker",
  "aud": "ai.infaix.com",
  "sub": "<users.id>",
  "role": "OWNER | ADMIN | USER",
  "ai_access": true,
  "iat": 0,
  "exp": 0,
  "jti": "jti_<24 hex>",
  "req": "<request binding>"
}
```

Lifetime ≈ 90 s (`ASSERTION_TTL_SEC`), 5 s clock tolerance. Signed with
`AI_GATEWAY_SECRET`; `AI_GATEWAY_SECRET_PREVIOUS` accepted during rotation.

### Request binding (canonical — implement identically in InfaixAI)

```
req = sha256hex( METHOD + "\n" + PATH + "\n" + sha256hex(bodyBytes) )
```

`METHOD` uppercase (`POST`), `PATH` the gateway path (`/chat`), `bodyBytes`
the exact bytes forwarded. Prevents transplanting an intercepted assertion
onto another request. No sensitive content inside the assertion.

### Secret rotation procedure

1. `wrangler secret put AI_GATEWAY_SECRET_PREVIOUS` ← current value.
2. `wrangler secret put AI_GATEWAY_SECRET` ← new value (≥32 chars).
3. Mirror both into the InfaixAI gateway config, newest as primary.
4. Wait > 90 s (max assertion lifetime), then remove `_PREVIOUS` on both sides.
5. Never log secrets, assertions, or session tokens.

## Interface contract for InfaixAI (implement independently)

### `POST {AI_GATEWAY_URL}/chat`

- Headers: `Authorization: Bearer <assertion>`, `Content-Type: application/json`,
  `X-Request-ID: req_<hex>` (trace, safe to log).
- Body: `{ "model": "<logical id, e.g. infaix-default>", "messages": [{ "role": "system|user|assistant", "content": "..." }], "stream": true }`.
- Auth: verify via `jose` `jwtVerify` — signature (current, then previous
  secret), `iss`, `aud`, `exp`/`iat`, required claims (`sub`, `role`,
  `ai_access === true`, `req`, `jti`), recompute `req` over the received
  method/path/body and compare (constant-time), optional in-memory `jti`
  replay cache (TTL 90 s).
- Response: `200` + `text/event-stream`, OpenAI-compatible
  `data: {"choices":[{"delta":{"content":"…"}}]}` frames, terminated by
  `data: [DONE]`. Honor the client disconnect (stop inference).

### `GET {AI_GATEWAY_URL}/models` (optional, future)

Only if the gateway ever needs to advertise capacity; the Worker serves the
logical model list itself and does not depend on this.

### Safe error categories (both sides)

`UNAUTHENTICATED 401 · FORBIDDEN 403 · INVALID_REQUEST 400 · RATE_LIMITED 429 ·
AI_UNAVAILABLE 503 · UPSTREAM_TIMEOUT 504 · MODEL_ERROR 502 · INTERNAL_ERROR 500`.
Gateway must never leak Ollama addresses, ports, paths, or stack traces; the
Worker maps gateway failures to these categories and always returns
`X-Request-ID`.

## Browser API (this repository)

- `GET /api/ai/models` — session required; `{ models: [{id, display}], ai_access }`.
- `POST /api/ai/chat` — `{ model, messages, conversationId? }` → SSE stream
  (+ `X-Conversation-ID`). Errors are JSON with `requestId`.
- `GET|POST /api/ai/conversations`, `GET|DELETE /api/ai/conversations/:id` —
  own conversations only (404 otherwise, never 403-differentiated).
- Auth pages/cookies unchanged; `/ai` UI uses these endpoints exclusively.

## Rate limiting split

- **Worker (this repo):** abuse shield — auth, per-user hourly + per-IP
  minutely budgets, body caps (`AI_CHAT_*` env).
- **InfaixAI:** GPU/model concurrency semaphore + per-model queues (not here).

## Conversations decision

**Main D1** (implemented): auth ownership stays with identity, rows die with
the user (`ON DELETE CASCADE`), no second user table. Graduate to hybrid
(SLAB-local message bodies) only if D1 throughput binds.

## Local development & testing

```bash
npm test                    # 77 unit tests incl. assertion + AI bridge (mocked upstream)
npm run lint && npm run build
npm run build && npx wrangler dev   # full stack needs AI_GATEWAY_URL or AI calls 503
```

Against a real gateway: set `AI_GATEWAY_URL=http://localhost:11434`-style
local URL **only in development** (production refuses non-HTTPS), create a
test user with `ai_access = 1`
(`UPDATE users SET ai_access = 1 WHERE email = '…'` via `wrangler d1 execute`),
and exercise `/ai` in the browser.

## Deployment prerequisites (InfaixAI side)

Tunnel `ai.infaix.com` → SLAB localhost gateway; gateway configured with the
same `AI_GATEWAY_SECRET` (+ previous during rotation); Ollama on `127.0.0.1`
only; logical model `infaix-default` pinned to an approved tag. No changes to
production DNS/Tunnel/D1 data were made from this repository.
