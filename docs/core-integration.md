# INFAIX Core integration contract (v1)

Core owns the canonical account ID, account status, identity lifecycle and platform roles. A product may own its own database and product permissions. It must not create a second unrelated INFAIX identity or accept roles/entitlements asserted by the browser.

## Discovery

`src/lib/app-registry.ts` is the canonical reviewed configuration. `app-contract.ts` contains the framework-independent serializable shape and release rules. Public Next server components pass only `getPublicApps()` to client components. Private entries are not serialized into the public site bundle.

`GET /api/apps` returns `{ version: 1, applications: [...] }` with the same public projection. It requires no identity storage and contains no private entries. Server-side consumers can fetch it from Core and cache for five minutes; browsers on other origins should use their own same-origin adapter. This endpoint does not add a new credentialed CORS policy. Preserve unknown fields when possible and reject unsupported contract versions. On discovery failure, retain navigation back to Core and show an unavailable state.

Fields: `id`, `name`, `description`, `url`, `icon`, `status`, `visibility`, `availability`, `requiresAuth`, optional `accessRequirement`. Icons are text glyphs from the existing geometric vocabulary. Runtime health is never derived from lifecycle. Public non-live entries have `url: null` and cannot launch. Restricted live entries may link to a product which enforces its own server-side entitlement.

Chat is `development / private / unavailable`. Its eventual destination is `https://chat.infaix.com`. An explicit release changes the registry entry to `live / public / available` (or restricted if appropriate), then rebuilds Core. Changing only the status is deliberately insufficient to publish a private app. DNS, product deployment and identity readiness must be handled separately by operators. This work does not launch Chat.

## Identity

The existing Worker is the identity authority. See `docs/authentication.md` for cookie scope, origin validation and CSRF behavior. Existing Core AI handlers verify the session and AI entitlement server-side and issue short-lived server-to-server assertions to the separate gateway.

The working tree already includes a private Chat identity handoff using `CHAT_ORIGIN`, `CHAT_IDENTITY_PRIVATE_KEY` and `CHAT_IDENTITY_AUDIENCE`. This task preserves it; it is not a general OIDC service and not an audited public SSO rollout. New products must agree a separately reviewed audience-bound integration and validate signatures, issuer, audience and expiry server-side. Do not share Core signing private keys with browsers or products, log assertions, or use registry visibility as authorization. A future general login protocol needs an explicit replay/redirect/revocation design.

## Navigation and visuals

Use the official logo to link to `https://infaix.com`; keep an account destination at Core. An app launcher is a disclosure of ordinary links, not a menu pretending to be an application desktop. The reusable reference is `app-launcher.tsx` plus `app-directory.tsx`. Tab/Shift+Tab traverse the trigger and launchable links; Enter/Space toggle the button; Escape closes and returns focus; focus leaving the disclosure and outside pointer interaction close it. Do not make planned entries focusable actions.

The Core implementation closes the launcher on navigation. Products may implement this contract in their own framework and deployment. No shared React runtime or monorepo is required. Preserve Core's `--void`, `--surface`, `--surface2`, `--border`, `--purple`, `--highlight`, `--text`, `--muted`, fonts, geometric artwork and reduced-motion behavior; see the design audit and existing design-system specification. Do not copy Core's operational routes into a product to obtain authorization.
