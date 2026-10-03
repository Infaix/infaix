# Phase 1 report — Public Identity & Trust (security + identity + data contracts)

> HISTORICAL REPORT — retained as provenance, not current security or release
> evidence. The statements and test counts below describe an earlier local
> phase and are not independently established for the approved combined baseline.
> Later account/newsletter/email UI work is present. Use `SECURITY.md`,
> `docs/auth.md` and `docs/public-registration.md` for current limitations.
>
> Corrections to historical claims: the 32,768-character check happens after
> `req.text()` has buffered the complete body and does not fix unbounded-read
> memory exposure. Limits use fixed windows and raw email scopes. Individual
> invite/token claims are conditional updates, not transaction-wide signup or
> redemption atomicity. Known/unknown-email timing is not equalized. Handoff
> checks origin only, not exact callback paths or query parameters. Signup still
> returns `201`/`409`, ignores client privilege fields and trusts stored invite
> roles. Turnstile, the signup kill switch, hashed atomic admission, mail
> timeout/idempotency and persisted continuation are not implemented.
>
> The historical edge suggestions below are not authorization to configure
> Cloudflare. The approved proposal is limited to the six expensive public Core
> auth paths and excludes handoff/start/callback routes. No migrations or
> deployments are authorized by this report.

Ownership: SECURITY + IDENTITY ARCHITECTURE + DATA CONTRACTS. No commit, no
deploy, no production D1 writes (all D1 verification used `--local` only).

## 1. Existing architecture (audited, not redesigned)

- **Signup (before):** invite-only. `POST /api/auth/register` required a
  43-char token → SHA-256 lookup in `invitations` (`PENDING`, unexpired,
  email-lock match) → user created with `inv.role` → atomic claim
  (`UPDATE … WHERE status='PENDING'`) → 24 h verification token mailed.
  Duplicate emails collapsed into `410 INVITATION_INVALID`.
- **Passwords:** PBKDF2-SHA256, 16-byte salt, 210k default iterations
  (`PBKDF2_ITERATIONS` tunable; wrangler sets 50000), 12–128 chars / 3-of-4
  classes, dummy-hash equalization on unknown-email login.
- **Sessions:** opaque 32-byte token, SHA-256 id at rest, `<token>.<hmac>`
  cookie (`HttpOnly`; prod `Domain=.infaix.com SameSite=None Secure`, dev
  host-only `Lax`), fresh mint per login (fixation-safe), 30-day sliding
  expiry, `ACTIVE` re-checked per request, immediate kill on disable.
- **Verification / reset (before):** hashed single-use tokens (verify 24 h,
  reset 1 h), atomic claims, neutral `200 {ok:true}` request endpoints,
  `Mailer` boundary (dev outbox / Resend / fail-closed unavailable).
- **Roles / ai_access / handoff / registry:** `OWNER|ADMIN|USER`;
  `ai_access` default deny with OWNER bypass via `canUseInfaixAI()`;
  Chat handoff (`/api/auth/chat`, audience `infaix-chat`) plus uncommitted
  Study-handoff work on branch `cursor/chat-public-origin` (left untouched);
  `app-registry` discovery-only (`canLaunch`, `publicApps` nulls URLs).
- **Rate limiting:** D1 fixed-window counters, per-IP everywhere + per-email
  on login only. **CSRF:** allowlisted `Origin`/`Referer` on state-changing
  API calls. **Headers:** `nosniff` + `Referrer-Policy` only (no CSP/HSTS in
  Worker by design). **Audit:** 22-event `audit_log`, no secrets.
- **Working tree (pre-existing, preserved):** `src/lib/app-registry.ts`
  (Study copy), `chat-handoff-contract.ts` refactor, `router.ts` + `types.ts`
  Study wiring, untracked `handoff*.ts`/`study-*.ts`/`auth-study-route.test.ts`.
  None were modified except additive `RL_*_EMAIL` env keys in `types.ts`.

## 2. Security findings → disposition

| # | Finding | Disposition |
|---|---|---|
| 1 | Invite required for identity; `inv.role` set the account role at signup | Fixed by design: token optional; absent → hardcoded `USER`; present → role from server-side row only; client privilege fields ignored (tested) |
| 2 | Unbounded `req.text()` in auth body parsing (isolate buffering DoS) | Fixed: 32 KB cap in `readJson` (tested) |
| 3 | Verify-resend / reset-request throttled per-IP only → rotating-IP inbox bombing | Fixed: per-address 5/hr gates (`RL_VERIFY_EMAIL_*`, `RL_RESET_EMAIL_*`) (tested) |
| 4 | Sibling PENDING tokens survived successful verify/reset (replay/probe surface) | Fixed: `expireUserVerifications/Resets` after success (tested) |
| 5 | Production debug `console.log` of bootstrap-token metadata in `adminAuth` | Fixed: removed |
| 6 | Registration audited `INVITATION_USED` but never `EMAIL_VERIFICATION_SENT` | Fixed: both audited appropriately |
| 7 | No CSP/HSTS in Worker; no 2FA; per-IP NAT sharing; PBKDF2 cost on Workers CPU | Accepted/documented — edge + roadmap items, not app-code fixes (§7) |
| 8 | Open redirects: handoff validates `return_to` against allowlist pre-session; login `safeReturnTo` same-path only | Verified, no change needed |
| 9 | Duplicate-email oracle at signup | Accepted explicitly: `409 ACCOUNT_EXISTS` (standard UX); login/reset/resend stay neutral (tested byte-identical) |

Nothing was weakened: invite atomicity, email locks, expiry, revocation,
dummy-hash equalization, session fixation defense, and admin/owner gates are
all intact and still tested.

## 3. Changes made (backend + minimal consistency edits)

- `worker/auth/handlers.ts` — public `handleRegister` refactor (§2 #1, #2,
  #4, #6); per-address throttles (#3); sibling-token invalidation (#4);
  removed prod bootstrap-token debug log (#5).
- `worker/auth/types.ts` — `RL_*_EMAIL_*` env keys; `NewsletterSubscriptionRow`,
  `ProductGrantRow` (+ status unions).
- `worker/auth/store.ts` / `memory.ts` — newsletter + product-grant CRUD.
- `db/migrations/0004_public_identity.sql` — new (additive, verified §4).
- `scripts/bootstrap-owner.mjs` — accepts `409 ACCOUNT_EXISTS` into the
  idempotent safe-state probe (revokes own unused invite as before).
- `src/app/register/{form,page}.tsx`, `src/app/login/form.tsx` — token
  optional, invite-only copy removed (no UI built beyond this).
- Docs: `docs/public-registration.md`, `docs/newsletter-contract.md`,
  `docs/privacy-data-inventory.md`; updated `SECURITY.md`, `docs/auth.md`,
  `db/README.md`.
- Tests: rewrote `tests/register.test.ts` (9 public + 9 invite-path), added
  `tests/public-registration.test.ts` (16), updated `helpers.ts`,
  `login/passwords/owner-bootstrap` tests for the new contract.

## 4. Migration

`0004_public_identity.sql`: creates `newsletter_subscriptions` and
`product_grants` (`IF NOT EXISTS`, indexes, FKs). Alters nothing, touches no
rows. Verified: 0001→0004 apply cleanly in order on local D1; upsert +
select smoke-tested; smoke row deleted. Rollback: leave tables in place on
revert (unread by old code, inert); `DROP TABLE` dev-only, never production.
Production application is explicitly out of scope (no `--remote` executed).

## 5. Contracts delivered

- **Public registration:** `docs/public-registration.md` §1–§2 (endpoint,
  safe defaults, error table, audit events).
- **Verification:** same doc §4 (24 h, single-use, hashed, resend, limits,
  generic responses, `Mailer` boundary).
- **Password reset:** same doc §5 (1 h, neutral requests, all-session kill,
  change-password semantics, no-resurrection for disabled accounts).
- **Newsletter:** `docs/newsletter-contract.md` (schema ↔ conceptual-field
  map, store API, Phase 2 endpoint sketch, no auto-subscribe rule).
- **Privacy/data inventory:** `docs/privacy-data-inventory.md` (accounts,
  sessions, IP metadata, audit events, tokens, cookies, AI data, app-access
  data, logs, third parties, retention unknowns — nothing invented).

## 6. Remaining Cloudflare edge recommendations (not app code)

1. WAF / rate-limit rules at the edge for `/api/auth/*` (app limits are
   friction, not DDoS defense); consider Managed Rules + Bot Fight Mode.
2. HSTS + CSP remain edge concerns (Worker intentionally ships neither;
   CSP needs per-build hash validation of the static export).
3. Turnstile (or equivalent) on `/api/auth/register` before public launch —
   open signup without bot friction will be abused regardless of rate limits.
4. Rotate/remove `ADMIN_BOOTSTRAP_TOKEN` once the first OWNER exists; set
   `SESSION_SECRET` (≥32 chars), `RESEND_API_KEY`, `EMAIL_FROM` as secrets
   (never in `wrangler.jsonc`).
5. Add a scheduled cron to prune `sessions`/`rate_limit_hits` and define
   token/audit retention (no TTL automation exists in-repo).
6. Confirm Cloudflare log retention meets the legal phase's requirements;
   restrict D1 access roles in the dashboard.

## 7. Files changed

Modified: `worker/auth/{handlers,types,store,memory}.ts`, `SECURITY.md`,
`docs/auth.md`, `db/README.md`, `scripts/bootstrap-owner.mjs`,
`src/app/register/form.tsx`, `src/app/register/page.tsx`,
`src/app/login/form.tsx`, `tests/{helpers,register,login,passwords,
owner-bootstrap}.test.ts` (+ harness `.ts`).
Added: `db/migrations/0004_public_identity.sql`,
`docs/{public-registration,newsletter-contract,privacy-data-inventory}.md`,
`tests/public-registration.test.ts`.
Untouched by design: Chat/Study handoff work, newsletter/campaign UI, legal
pages, marketing UI, payments, production data/secrets/DNS.

## 8. Tests

New/updated coverage: public signup without token; safe defaults
(`USER/PENDING/not-verified/ai_access=0`); client privilege fields ignored;
login blocked pre-verification; `409` duplicates without overwrite; oversized
bodies; rate limits (IP + per-address); invite path still honored
(role-from-row, expiry, revocation, reuse, email lock, malformed → 400,
dead → 410); verification/reset lifecycles (malformed/expired/reused/sibling
invalidation/disabled-account); enumeration byte-equality for reset/resend;
`ai_access` preservation + non-owner denial; private-product protection via
`canLaunch`/`publicApps`; newsletter consent isolation + lifecycle;
product-grant mint/list/revoke.

## 9. Historical quality-gate report (not verification of the combined baseline)

- `npm test` — **210 passed / 25 files**
- `npx tsc --noEmit` — clean
- `npm run lint` — clean (0 errors, 0 warnings)
- `npm run build` — success (19 static routes)
- `npx wrangler deploy --dry-run` — success
- `git diff --check` — clean
- D1: migrations 0001→0004 apply on `--local`; new-table upsert verified

Not committed, not deployed, per milestone boundaries. Phase 2 entry points:
`Mailer` interface for the provider, `docs/public-registration.md` error
tables for UI copy, `docs/newsletter-contract.md` endpoint sketch,
`product_grants` + `source_invitation_id` for invite-to-product redemption.
