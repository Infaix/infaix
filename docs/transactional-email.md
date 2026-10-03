# Transactional email

Account mail is separate from the newsletter. Security messages do not include
product news, offers, or unsubscribe-from-marketing copy.

## Provider boundary

All delivery goes through `Mailer` in `worker/auth/mailer.ts`. Handlers do not
call a vendor SDK.

| `ENVIRONMENT` | Behaviour |
|---|---|
| Anything other than `production` (local, test) | `OutboxMailer` writes `email_outbox`. No HTTP request is made. |
| `production` with `EMAIL_PROVIDER=resend`, a non-empty `EMAIL_FROM`, and `RESEND_API_KEY` | `ResendMailer` posts to `https://api.resend.com/emails`. |
| `production` without that trio | `UnavailableMailer`. Register, verification resend, and password-reset request return `503 EMAIL_UNAVAILABLE` before any token or account mutation. |

`RESEND_API_KEY` is a Worker secret (`wrangler secret put RESEND_API_KEY`).
It is not a `wrangler.jsonc` var and must not be committed. `EMAIL_PROVIDER`
and `EMAIL_FROM` may be non-secret vars. `EMAIL_FROM` must be an address the
provider has verified.

No other provider is wired. Adding one means a new class that implements
`Mailer` and a branch in `mailerFor`. Templates stay in
`worker/auth/email-templates.ts`.

## Messages

| Method | Subject | When |
|---|---|---|
| `sendVerification` | Verify your INFAIX account | Signup and verification resend. Link expires in 24 hours, single use. |
| `sendWelcome` | Welcome to INFAIX | After a successful verification. Says the account is identity only. |
| `sendPasswordReset` | Reset your INFAIX password | Reset request. Link expires in 1 hour, single use. |
| `sendPasswordChanged` | Your INFAIX password was changed | After a password change or a completed reset. |

`renderEmailChangedEmail` is the security notice for an address change. Core
has no email-change endpoint, so that template is not sent.

Each message has an HTML body (no remote images, inlined type, a text link as
well as a button) and a plain-text body. Expiry is stated on the messages that
carry a link. Wording does not invent urgency.

Welcome and password-changed mail run after the account change is committed.
If that send fails, the verification or password change still stands.

That means a successful account operation does not prove a notice was delivered.
The current account UI's confirmation-email success wording is optimistic, not
a delivery guarantee. Provider calls currently have no bounded timeout or
idempotency key; free-form error logging also remains to be hardened. Combined
email quotas/cooldown and these delivery protections belong to the approved
security plan, not this baseline.

## Dev and test

`npm test` and any Worker with `ENVIRONMENT` other than `production` use the
outbox. Completing a flow means reading `email_outbox.link_token` for
`email_verification` or `password_reset`. Notice rows use `link_token = notice`
and contain no secret. Do not point a non-production environment at Resend.
