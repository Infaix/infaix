# Newsletter data contract — baseline storage and consent hooks

The baseline includes registration/account consent controls and the endpoints
listed below. There is no campaign sending infrastructure or confirmation-token
flow. New consent remains pending; the UI must not promise a confirmation email.

## Rule

Newsletter consent is **fully separate from account creation**. Registering
an account never creates, implies, or modifies a newsletter subscription
(covered by test: `registration never creates newsletter consent`).

## Schema (`db/migrations/0004_public_identity.sql`)

`newsletter_subscriptions`:

| Column | Meaning |
|---|---|
| `email` (PK) | Subscriber address, lowercase |
| `status` | `SUBSCRIBED` \| `UNSUBSCRIBED` \| `PENDING_CONFIRMATION` |
| `consent_at` | When consent was last given (ms epoch) |
| `consent_source` | Capturing surface, e.g. `footer-form`, `homepage`, `account-settings`, `registration` |
| `policy_version` | Consent text / privacy-policy version shown at consent time |
| `confirmed_at` | Double-opt-in confirmation time |
| `unsubscribed_at` | Set on unsubscribe; **row is retained** (consent audit trail) |
| `created_at`, `updated_at` | Lifecycle timestamps |

Conceptual fields from the milestone map 1:1: email → `email`;
subscription status → `status`; consent timestamp → `consent_at`; consent
source → `consent_source`; consent text/policy version → `policy_version`;
unsubscribe timestamp → `unsubscribed_at`; confirmation state → `status` +
`confirmed_at`. No existing or new user is auto-subscribed, ever.

## Store API (`worker/auth/store.ts`, mirrored in `memory.ts`)

- `getNewsletterByEmail(email)` — lookup, null when never subscribed
- `upsertNewsletter(sub)` — insert or refresh consent metadata (no duplicates)
- `setNewsletterStatus(email, status, now)` — status transition; sets
  `unsubscribed_at` on `UNSUBSCRIBED`; false when no row

Type: `NewsletterSubscriptionRow` in `worker/auth/types.ts`.

## Phase 2 endpoints

Implemented:

- `POST /api/newsletter/subscribe` `{ email, source, policyVersion, consent: true }`
  → upsert `PENDING_CONFIRMATION` (an existing `SUBSCRIBED` row stays
  subscribed and only refreshes consent metadata). `source` is one of
  `registration`, `account-settings`, `footer-form` or `homepage` (the
  allowlist is `NEWSLETTER_SOURCES` in `src/lib/newsletter-consent.ts`;
  Phase 3 added the two public surfaces so the record names where consent was
  actually captured). `policyVersion` must be the current consent text
  version. `consent` must be boolean `true`; anything else writes nothing.
  Per-IP and per-address rate limits. Response is `{ ok: true }` for every
  accepted address (no account oracle). Does not create an account and does
  not send marketing mail.
- `GET /api/newsletter/me` (session) → `{ status }` for the signed-in address only.
- `POST /api/newsletter/withdraw` (session) → `UNSUBSCRIBED` when a row exists;
  no row is created for an address that never opted in.

Not implemented (no confirmation-token table, so a confirm link would be undeliverable):

- `POST /api/newsletter/confirm` `{ token }` → `SUBSCRIBED` + `confirmed_at`
- Public `POST /api/newsletter/unsubscribe` `{ email }` and one-click token links.
  Session withdraw covers the account preferences control. A public unsubscribe
  that anyone can trigger for any address is deferred until it is token-gated.

Subscribe never requires or creates an account. Nothing in registration writes
a newsletter row unless the person checks the separate optional control, which
calls subscribe after the account exists.

## Privacy notes for the legal phase

- Unsubscribe is a status change, not deletion — retention/erasure policy must
  decide how long `UNSUBSCRIBED` rows live (see privacy inventory).
- `policy_version` lets counsel verify *what text* each address consented to.
- Double opt-in (`PENDING_CONFIRMATION` default) is recommended before any
  marketing send.
