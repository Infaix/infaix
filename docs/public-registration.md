# Public registration, verification & password-reset contracts (Phase 1)

Backend contracts for public INFAIX Core registration. Consumers: Phase 2
(transactional email wiring, registration/verification UI, legal/privacy).
No email provider is hardcoded: all delivery flows through the `Mailer`
service boundary (`worker/auth/mailer.ts`).

Fundamental rule: **an INFAIX account is an identity, not product access.**
Public signup grants only the base `USER` role, no `ai_access` and no product entitlement.

Baseline status: public signup assigns the base `USER` role, or uses an
optional authorized invitation's stored role. This is not the approved
hardening implementation. Generic `202` signup responses, privilege-field
rejection, a signup kill switch, Turnstile, hashed throttles, atomic signup/mail
admission and persisted return destinations remain planned. Do not deploy this
baseline as a completed public-signup security release.

## 1. Public registration

`POST /api/auth/register` — same-origin, CSRF origin check enforced.

Request: JSON, fully buffered before a 32,768-character length check. This is
not a byte limit or a bound on memory consumed while reading the body.

| Field | Required | Notes |
|---|---|---|
| `email` | yes | Validated + lowercased server-side |
| `password` | yes | Policy: 12–128 chars, ≥ 3 of 4 classes |
| `displayName` | yes | 1–60 chars, control chars rejected |
| `token` | no | Legacy operator-invite token (see §3) |
| `legal.accepted` | yes | Boolean `true` |
| `legal.termsVersion` | yes | Must equal the server's current Terms version |
| `legal.privacyVersion` | yes | Must equal the server's current Privacy version |

Missing, false, or stale acknowledgement is `400 LEGAL_ACK_REQUIRED` and creates no account. A valid request writes the user and the acceptance together in one storage transaction (`D1.batch`). If that acceptance write fails, including because `legal_acceptances` is missing, no account is left behind. The stored row uses the server versions and `source = registration`. It does not create a newsletter subscription. Apply `0005_legal_acceptance.sql` before enabling this registration path.

`role`, `ai_access`, `status`, `email_verified` in the body are **ignored** —
privilege is never read from client input (tested).

Responses:

| Case | Status | Body |
|---|---|---|
| Created | `201` | `{ user: PublicUser }` (safe defaults, §2) |
| Duplicate email | `409` | `{ error: { code: "ACCOUNT_EXISTS" } }` — no row change |
| Bad input | `400` | `INVALID_INPUT` |
| Malformed invite token | `400` | `INVALID_INPUT` |
| Dead invite token (unknown/expired/used/revoked/mismatched) | `410` | `INVITATION_INVALID` |
| Rate limited | `429` | `RATE_LIMITED` + `Retry-After` |
| No mail delivery (production) | `503` | `EMAIL_UNAVAILABLE` — nothing persisted |

A verification token (24 h) is issued and mailed at signup. Login stays
blocked (`403 EMAIL_NOT_VERIFIED`) until verification completes.

## 2. Safe defaults (guaranteed server-side)

Every public signup creates exactly:

- `role = "USER"` (hardcoded; `ADMIN`/`OWNER` unreachable without an invite row)
- `status = "PENDING_VERIFICATION"`
- `email_verified = 0`
- `ai_access = 0` (default deny; OWNER sessions or explicit OWNER grant only)
- no session, no product grant, no newsletter consent

Audit on success: `ACCOUNT_CREATED` (`role:USER`) + `EMAIL_VERIFICATION_SENT`.
With an invite: additionally `INVITATION_USED`.

## 3. Invitations (operator seeding; future product grants)

`token` is **optional**. When supplied it must resolve to a live server-side
invitation (`PENDING`, unexpired, email-lock match) which is claimed
atomically (`UPDATE … WHERE status='PENDING'`) and supplies the role. A lost
claim race disables the orphaned user row (no login possible). A supplied
but dead token fails closed with `410` — never a silent public signup.

Only the invitation claim is an atomic conditional update. User insertion,
claim and verification-token insertion are not one transaction. Registration
trusts the stored invite role without the planned runtime role allowlist.

Preserved verbatim: `invitations` table, migrations 0001, admin
invite endpoints, `scripts/new-invite.mjs`, `scripts/bootstrap-owner.mjs`
(which now also accepts the `409 ACCOUNT_EXISTS` duplicate signal).

Migration path: invitations become product/beta access grants by minting
`product_grants` rows with `source_invitation_id` set at redemption time
(schema + store methods land in migration 0004; no HTTP surface yet).

## 4. Email verification contract

| Endpoint | Behavior |
|---|---|
| `POST /api/auth/request-verification` `{ email }` | Normally neutral `200 { ok: true }` (unknown/verified addresses included), subject to rate-limit/provider errors. Only `PENDING_VERIFICATION` accounts mint a new token (prior PENDING tokens expired first). |
| `POST /api/auth/verify-email` `{ token }` | `200` activates (`ACTIVE`, `email_verified=1`, audit `EMAIL_VERIFIED`, welcome mail) and expires sibling PENDING tokens. Malformed → `400`. Unknown or disabled → `410 VERIFICATION_INVALID`. Expired → `410 VERIFICATION_EXPIRED`. Used while the account is still unverified → `410 VERIFICATION_USED`. Used or superseded after the account is active → `410 ALREADY_VERIFIED`. |

Token properties: 32 random bytes (base64url, 43 chars), SHA-256 at rest,
24 h expiry, single-use atomic claim, raw value only inside the mail body
(dev: `email_outbox`). Rate limits: 10/hr per IP + 5/hr per address
(`RL_VERIFY_*`, `RL_VERIFY_EMAIL_*`).

## 5. Password-reset contract

| Endpoint | Behavior |
|---|---|
| `POST /api/auth/request-password-reset` `{ email }` | Normally neutral `200 { ok: true }`, subject to rate-limit/provider errors. Existing non-disabled accounts: prior PENDING tokens expired, new 1 h token mailed, audit `PASSWORD_RESET_REQUESTED`. |
| `POST /api/auth/reset-password` `{ token, newPassword }` | `200` on success: atomic claim, password re-hash, **all** sessions revoked, sibling PENDING tokens expired, audit `PASSWORD_RESET_COMPLETED`, then `{ passwordChanged: true, notificationDelivered }`. Unknown or disabled → `410 RESET_INVALID` (no resurrection). Expired → `410 RESET_EXPIRED`. Already used → `410 RESET_USED`. |
| `POST /api/auth/change-password` (session) | Requires current password; revokes all *other* sessions; audit `PASSWORD_CHANGED`. Response `{ passwordChanged: true, notificationDelivered }` after the password is saved. A failed security email does not undo the change and is not described as sent. |

Token properties mirror verification (1 h expiry). Rate limits: 5/hr per IP +
5/hr per address (`RL_RESET_*`, `RL_RESET_EMAIL_*`). Response-body equality
does not equalize timing: known accounts perform token writes and mail delivery.
Verification/reset claims and subsequent account updates are separate writes.

## 6. Rate-limit matrix (all D1-backed, `429` + `Retry-After`)

| Scope | Default |
|---|---|
| register per IP | 10 / hr |
| login per IP / per email | 10 / 10 min, 20 / 10 min |
| verify send+use per IP | 10 / hr |
| verify resend per address | 5 / hr |
| reset request+use per IP | 5 / hr |
| reset request per address | 5 / hr |
| newsletter opt-in per IP / per address | 10 / hr, 5 / hr |
| admin / owner-admin per IP | 30 / hr |
| AI chat user / IP | separately configured |

Application limits are abuse friction, **not** DDoS protection — see the
Cloudflare edge recommendations in the Phase 1 report.

These are fixed-window counters, incremented/read in separate D1 queries.
Email scopes store raw addresses. The approved hashed atomic admission and
shared email cooldown are not yet present.

## 7. Mailer service boundary (for Phase 2)

```ts
interface Mailer {
  sendPasswordReset(toEmail: string, link: string, now: number): Promise<void>;
  sendVerification(toEmail: string, link: string, now: number): Promise<void>;
  sendWelcome(toEmail: string, loginUrl: string, now: number): Promise<void>;
  sendPasswordChanged(toEmail: string, resetUrl: string, now: number): Promise<void>;
}
```

`mailerFor(store, env)`: non-production → `OutboxMailer` (deterministic
`email_outbox`, no network delivery); production → `ResendMailer` iff
`EMAIL_PROVIDER=resend` + `EMAIL_FROM` + `RESEND_API_KEY`, else
`UnavailableMailer` (fails closed: registration/reset/resend return `503`
before any mutation, uniformly for known and unknown addresses). Templates
and configuration live in `docs/transactional-email.md`. Welcome and
password-changed notices are sent after the account change succeeds; a
delivery failure does not roll that change back.
