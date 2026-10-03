# Phase 3 report — Public Identity & Trust (legal surfaces, consent, product news)

Ownership: PRIVACY UX + LEGAL SURFACES + COOKIE/CONSENT UX + NEWSLETTER UX.
No commit, no deploy, no production D1 write, no DNS change, no new dependency.
Nothing here claims a certification, a retention period, a processor contract
or a legal entity that the repository does not establish.

## 1. Cookie and storage audit (the finding everything else follows from)

Searched `src/`, `worker/`, `public/`, `next.config.ts`:

| Technology | Result |
|---|---|
| `document.cookie` | No occurrences |
| `localStorage` / `sessionStorage` / `indexedDB` | No occurrences |
| Cache API / service worker | No occurrences |
| Third-party `<script>`, `next/script`, tag manager, analytics, pixel | No occurrences |
| `public/` contents | One asset |

The only cookie the Worker sets is `infaix_session`
(`worker/auth/sessions.ts`, `buildSetCookie`): `HttpOnly`, `Secure` in
production, `SameSite=None` + parent-domain in production / host-only `Lax` in
dev, 30-day sliding expiry, minted on login only.

**Consequence: no consent dialog was built.** There is nothing optional to
consent to, so an "Accept all cookies" interstitial would be theatre. The
cookie surface is disclosure instead. `tests/legal-content.test.ts` asserts the
documented cookie set equals the real `SESSION_COOKIE`, and asserts the new UI
files contain no storage API calls at all.

## 2. Legal centre

Routes: `/legal`, `/legal/privacy`, `/legal/terms`, `/legal/cookies`
(19 → 23 static routes). All four added to `src/app/sitemap.ts`.

Content lives in `src/lib/legal-content.ts` (model + review markers) and
`src/lib/legal/{privacy,terms,cookies}.ts` (prose). `src/components/legal-document.tsx`
renders any of them. The content is data, not JSX, so it is scannable and
assertable in tests.

## 3. Verified data inventory used

Everything claimed in the privacy policy is taken from the Phase 1/2 contract
documents and the code:

- `users` fields exactly as stored; PBKDF2-SHA256 salted hash, never reversible.
- `sessions`: token hashed at rest, sliding 30-day expiry, mint-time IP,
  200-char user agent; revoked on logout, password change, reset, disable.
- `audit_log`: the 20-odd event names, per-event IP, `detail` capped at 200
  chars; the exclusion of passwords, hashes and tokens.
- Single-use token lifetimes actually enforced: verification 24 h, reset 1 h,
  invitation 72 h default.
- `newsletter_subscriptions` columns, including that unsubscribe is a status
  change and the row is retained.
- Request logging: route label enum, method, status, latency, login auth result
  only — no headers, bodies, cookies or query strings.
- Four reachable processors: Cloudflare, Resend, the AI gateway, and Chat/Study
  handoff carrying a signed assertion with no profile data.
- Retention: stated as *enforced lifetimes* versus *not yet decided*. No
  retention period is promised for accounts, audit rows, tokens, sessions,
  newsletter rows, conversations or platform logs.

## 4. Terms: service honesty

The service-status table is **generated from `INFAIX_APPS`**, the same registry
that drives the product directory, so it cannot drift from reality. INFAIX
Shop renders as `Planned` / "Not operating. INFAIX does not currently sell
anything, take payments or accept orders." Study and Atlas likewise. Liability,
warranty, IP licence and governing-law provisions are written as positions or
left open with a review marker — none were invented.

## 5. Consent and product news

- **Signup** (`src/app/register/form.tsx`): a required, unticked Terms/Privacy
  acknowledgement naming `terms-2026-10-03` and `privacy-2026-10-03`, blocking
  submit; and a separate optional marketing checkbox inside a
  `<fieldset><legend>Optional — INFAIX product news</legend>`, so the
  distinction is structural rather than typographic. Neither is preselected.
- **Public subscribe** (`src/components/newsletter-form.tsx`): footer and
  homepage. No account required or created. Uses the existing
  `POST /api/newsletter/subscribe` contract with `consent: true` sent only after
  the box is ticked. Response copy never implies whether an account exists or
  whether the address was already subscribed, because the endpoint returns the
  same `{ok:true}` either way.
- **Preferences**: the Phase 2 account dashboard control remains the place to
  start/stop and the only withdrawal path; a legal-document block was added
  beside it.
- **Marketing vs transactional**: stated on the form, on the homepage, in the
  signup form and in the privacy policy. Unsubscribe is marketing-only and
  cannot disable verification, reset or security mail.
- **Copy position**: launches, project updates, beta/early access, major
  releases. A test asserts "free advertising" appears nowhere.
- No popups, no interstitials, no scroll traps.

### Backend change (approved)

`NEWSLETTER_SOURCES` gained `footer-form` and `homepage` so `consent_source`
names the surface consent was actually captured on. The Worker imports the same
constant, so the allowlist follows automatically; no migration, no schema
change, and `registration` / `account-settings` are unaffected. Recorded in
`docs/newsletter-contract.md`.

## 6. Accessibility review (WCAG 2.2 AA target, self-assessed)

Not a certification; a review against the project's existing target.

- **Keyboard**: full reachability — skip link → primary nav → document meta →
  contents list → body → footer. Wide tables sit in `role="region"` +
  `tabindex=0` + `aria-label`, so they are scrollable without a mouse and no
  page-level sideways scroll is required.- **Targets**: contents links raised from 34 px to a 44 px minimum. Standalone
  controls were measured at every breakpoint on `/`, `/legal/privacy`,
  `/register` and `/legal/cookies` — 1440, 1280, 1024, 768, 390, 375 and 320 —
  and none is under 44 px on either axis. Inline links inside running prose and
  the checkbox labels (which wrap a 44 px-tall control) are exempt from target
  size and are excluded from that count.
- **Contrast**: every new text style measured against its composited
  background; range 4.61:1 → 17.34:1, all at or above AA for normal text. The
  low end is the decorative marker-id chip.
- **Labels**: every input has a real `<label>`; the error is `role="alert"`,
  receives focus, and the invalid field gets `aria-invalid`.
- **Headings / landmarks**: one `h1` per page, no skipped levels, single
  `main`/`header`/`footer`, contents list is a labelled `<nav>`.
- **Motion**: new styles use transitions only; the existing global
  `prefers-reduced-motion` rule already neutralises them. No new animation.
- **Reflow / zoom**: measured, not assumed. Zero horizontal overflow at every
  width above, on every page checked. The contents rail collapses from two
  columns to one at 900 px and the table region becomes independently
  scrollable below ~560 px, so the page itself never scrolls sideways at any
  size. `/register` was checked at 320 px specifically because `fieldset` has a
  min-content sizing trap; the optional-marketing fieldset renders at 213 px
  with no overflow.
- **Readability**: 68ch measure, 1.75 line height, sticky contents on desktop.
- Verified in-browser: submitting the newsletter form unticked produces the
  consent error, moves focus to it, and marks the field invalid.

## 7. Homepage and footer

The signature footer is unchanged (mark, wordmark, tagline, axis, link row,
bottom bar). Added below it: a product-news band and a legal row. The homepage
gained a sixth band in the asymmetric-instrument mode.

Homepage document height, measured: 6,101 px at 1440, 6,546 at 1024, 7,813 at
768, 8,928 at 390, 9,050 at 375. Against the 6,835 px that Phase 0 finished at
390 px, this is +2,093 px. That is real content, not a regression: a subscribe
form and the marketing/transactional distinction each appear twice, on the
homepage and in the footer. `/legal/privacy` measures 14,986 px at 1280 and
`/legal` 14,226 px at 1440, because both carry all 29 decisions or their full
text. Both are reference pages reached by explicit navigation, not landing
pages.

## 8. Gates (all green, 2026-10-03)

- `npm test` — 245 passed / 28 files (was 210 / 25; +24 legal tests, +11 from
  the Phase 1/2 tree already present)
- `npx tsc --noEmit` — clean
- `npm run lint` — clean, 0 errors 0 warnings
- `npm run build` — 23 static routes
- `npx wrangler deploy --dry-run` — 142.47 KiB / 32.94 KiB gzip
- `git diff --check` — clean

Chat remains private: no `infaix-chat-dev` or `127.0.0.1` string in `out/`.
Nothing deployed.

### Environment note

`out/` was wiped twice mid-review by something outside these commands — once
while a static preview server was running, once with no build in flight — and
the preview server crashed both times. Every gate and every browser measurement
above was therefore taken against a freshly built `out/` in the same step, and
re-verified after each rebuild. Worth knowing before trusting a stale `out/`
tree; a Windows build also fails with `ENOTEMPTY` if a preview server still
holds files in it, so stop the server before rebuilding.

## 9. Unresolved decisions

29 markers live in `REVIEW_MARKERS`, grouped on `/legal#decisions`, and each one
appears inline in the document that needs it. A test asserts the groups
partition the marker set, so a decision cannot be added without showing up.

**Who INFAIX is, and who to ask** — legal entity and registered address;
monitored privacy contact channel; applicable regime and regulator; lawful basis
per purpose; processing locations and transfer mechanism; formal processor list;
minimum age.

**Retention** — accounts after closure; audit log; spent single-use tokens;
expired sessions and rate-limit counters; newsletter records including
unsubscribed rows; AI conversations; Cloudflare edge log retention.

**Rights, requests and consent** — erasure requests (no self-service deletion
exists today); formal access and rectification requests; unsubscribe for people
who subscribed with only an email address; marketing send infrastructure and
the double opt-in confirmation flow; the consent gate to be used if optional
technology is ever introduced.

**Terms drafting** — suspension and termination procedure; whether acceptance
should be recorded server-side and how; limitation of liability; warranty
disclaimer; user content and feedback licensing; trademarks; availability
commitments; governing law and forum; acceptable-use detail; whether Study,
Atlas and Shop carry their own terms on launch.

## 10. Files

Added: `src/lib/legal-content.ts`, `src/lib/legal/{privacy,terms,cookies}.ts`,
`src/lib/legal-documents.ts`, `src/lib/legal-decisions.ts`,
`src/lib/legal-versions.ts`, `src/components/legal-document.tsx`,
`src/components/newsletter-form.tsx`, `src/app/legal/**`,
`tests/legal-content.test.ts`, `docs/phase-3-legal-trust.md`.

Modified: `src/app/globals.css`, `src/components/Footer.tsx`,
`src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/sitemap.ts`,
`src/app/register/form.tsx`, `src/app/account/dashboard.tsx`,
`src/lib/newsletter-consent.ts`, `docs/newsletter-contract.md`.

Dependencies: none added. `package.json`, `package-lock.json` and
`wrangler.jsonc` untouched.