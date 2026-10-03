/**
 * INFAIX Core — Privacy Policy.
 *
 * Source of truth for every claim here is the repository itself: the Worker,
 * the D1 migrations, the static site, and the Phase 1/2 contract documents in
 * `docs/`. Where a statement would require a business or legal decision, the
 * section carries a `review` block rather than an invented fact.
 */

import type { LegalDocument } from "../legal-content";

export const privacyPolicy: LegalDocument = {
  slug: "privacy",
  label: "Privacy",
  title: "Privacy Policy",
  summary:
    "What INFAIX Core actually stores, why it stores it, and where the honest limits of that description are.",
  version: "privacy-2026-10-03",
  effective: "3 October 2026",
  sections: [
    {
      id: "scope",
      heading: "What this policy covers",
      blocks: [
        {
          kind: "p",
          text: "This policy describes INFAIX Core — the site at [[infaix.com|/]] and the account system behind it. It describes the software as it is actually built, not as it is intended to grow.",
        },
        {
          kind: "p",
          text: "Other INFAIX products are separate services with their own privacy practices. Where Core hands you over to one of them, the handoff is described in [[Your rights|/#rights]] and is limited to a signed identity assertion, not a copy of your profile.",
        },
        {
          kind: "review",
          marker: "legal-entity",
        },
        {
          kind: "review",
          marker: "regime",
        },
      ],
    },
    {
      id: "summary",
      heading: "The short version",
      blocks: [
        {
          kind: "p",
          text: "If you read nothing else, read this. It is accurate and it is complete enough to be useful.",
        },
        {
          kind: "ul",
          items: [
            "If you create an account, INFAIX stores your email address, a display name you choose, and a one-way hash of your password. Your password itself is never stored and can never be read back.",
            "INFAIX stores one session cookie, and nothing else in your browser. There is no analytics script, no advertising identifier, and no third-party tracker anywhere on this site.",
            "INFAIX keeps a security log of things that happened to your account: sign-ins, password changes, verification, and access decisions. It records the network address of the request.",
            "If you subscribe to product news, INFAIX stores your email address and the fact that you agreed. That record is kept separately from your account and is never created for you automatically.",
            "Account mail such as verification and password reset is transactional. It is sent because your account needs it, it is not marketing, and turning off product news does not turn it off.",
            "INFAIX does not sell data, does not run advertising, and does not build a profile of you across sites.",
          ],
        },
        {
          kind: "fact",
          title: "Why this document looks unusual",
          text: "Privacy policies are usually full of statements nobody verifies. This one is generated from INFAIX's own code, so where a real fact was missing it says so instead of guessing. Every gap is marked for review and listed on the [[legal centre|/legal]] page.",
        },
      ],
    },
    {
      id: "collected",
      heading: "Information INFAIX collects",
      blocks: [
        {
          kind: "p",
          text: "Everything below is a field that exists in the INFAIX database or a record the software writes. Nothing is described here that the system does not do.",
        },
        {
          kind: "h3",
          text: "Account information",
        },
        {
          kind: "p",
          text: "Creating an INFAIX account stores exactly these fields and no others:",
        },
        {
          kind: "table",
          caption: "Account fields",
          head: ["Field", "What it holds", "Why it exists"],
          rows: [
            ["Email address", "Your address, stored in lowercase, unique across accounts", "It is your identity on INFAIX and the destination for account mail"],
            ["Display name", "1–60 characters that you choose", "How you appear in the account area"],
            ["Password hash", "A salted one-way PBKDF2-SHA256 derivation", "To verify a sign-in without ever storing the password"],
            ["Role", "Member, Admin or Owner", "Determines what you can administer; new public signups are always Member"],
            ["Account status", "Pending verification, Active or Disabled", "Controls whether sign-in works"],
            ["Verification state", "Whether your address has been confirmed", "Proves you control the mailbox"],
            ["Timestamps", "Created, updated and last sign-in time", "Operational records and account history"],
            ["AI access flag", "On or off, off by default", "Separate access to a restricted product; not granted at signup"],
          ],
        },
        {
          kind: "fact",
          title: "Your password cannot be recovered",
          text: "INFAIX stores a salted hash produced by PBKDF2-SHA256. It is not reversible and it is never emailed, logged or displayed. If you forget your password, you reset it; nobody can read the old one, including the operator.",
        },
        {
          kind: "h3",
          text: "Session information",
        },
        {
          kind: "p",
          text: "When you sign in, INFAIX creates a session. The browser receives an opaque random token in a cookie that scripts cannot read. The server stores only a hash of that token, plus:",
        },
        {
          kind: "ul",
          items: [
            "The account the session belongs to.",
            "When it was created, when it was last seen, and when it expires. Sessions expire after 30 days of use and refresh while you stay signed in.",
            "The network address of the request that created the session.",
            "The first 200 characters of your browser's user-agent string.",
          ],
        },
        {
          kind: "p",
          text: "Signing out deletes the session. Changing your password signs out every other session. Resetting your password signs out all of them.",
        },
        {
          kind: "h3",
          text: "Security and audit information",
        },
        {
          kind: "p",
          text: "INFAIX writes an audit record for security-relevant events: sign-in success and failure, sign-out, account creation and disablement, profile changes, password changes and resets, email verification, invitations, and access decisions for the restricted AI product. Each record stores the event, the accounts involved, the network address of the request, and a short free-text detail of at most 200 characters.",
        },
        {
          kind: "fact",
          title: "What the audit log never contains",
          text: "Passwords, password hashes, session tokens and link tokens are excluded by design and enforced by the project's tests. They are not written to the audit log under any code path.",
        },
        {
          kind: "h3",
          text: "Single-use link tokens",
        },
        {
          kind: "p",
          text: "Invitations, password resets and email verification all use single-use tokens. Only a hash of each token is stored. The raw value exists only inside the email message that carries the link. Verification links last 24 hours, password reset links one hour, and invitations a configurable period of 72 hours by default. Used and expired tokens are marked as such rather than deleted.",
        },
        {
          kind: "h3",
          text: "Product news subscription",
        },
        {
          kind: "p",
          text: "Subscribing to INFAIX product news stores your email address, the status of your subscription, the moment you agreed, which surface captured that agreement, and the version of the consent text you were shown. If you later unsubscribe, the record is kept with an unsubscribe timestamp, because the record of your having consented is itself part of the audit trail.",
        },
        {
          kind: "fact",
          title: "Creating an account never subscribes you",
          text: "Registration and the newsletter are deliberately separate. Creating an account never creates a subscription, and the newsletter checkbox is never pre-ticked. A subscription only exists because someone actively asked for one.",
        },
        {
          kind: "h3",
          text: "Technical request logs",
        },
        {
          kind: "p",
          text: "For each request to the INFAIX API, the service records a small structured line containing the route, the HTTP method, the response status, how long it took, and — for sign-in attempts only — whether authentication succeeded. Route names come from a fixed list. Query strings, request headers, cookies, request bodies and identifiers are deliberately excluded.",
        },
        {
          kind: "h3",
          text: "Content you create in INFAIX AI",
        },
        {
          kind: "p",
          text: "INFAIX AI is a restricted product. If your account has been given access and you use it, your conversations and messages are stored against your account so the product can work across your sessions, and you can delete individual conversations yourself. Access to this product is granted separately and is not part of holding an account.",
        },
        {
          kind: "h3",
          text: "What INFAIX does not collect",
        },
        {
          kind: "ul",
          items: [
            "No advertising identifiers, tracking pixels or cross-site profiles.",
            "No third-party analytics, session-replay or experimentation tooling.",
            "No payment card details. INFAIX does not currently take payments.",
            "No government identity documents, biometric data, or special-category personal data.",
            "No contacts, calendar, location or device inventory. INFAIX cannot read your address book and does not ask for access to it.",
          ],
        },
        {
          kind: "review",
          marker: "age",
        },
      ],
    },
    {
      id: "why",
      heading: "Why the information is collected",
      blocks: [
        {
          kind: "p",
          text: "Each purpose below maps to data that exists for that purpose and no other.",
        },
        {
          kind: "table",
          caption: "Purpose and the data it requires",
          head: ["Purpose", "Data used"],
          rows: [
            ["Let you create and sign in to an account", "Email address, password hash, display name, verification state, session records"],
            ["Confirm that you control your email address", "Email address, single-use verification token, confirmation timestamp"],
            ["Keep the account secure", "Audit events, network address, session records, password-change and reset events"],
            ["Send transactional messages", "Email address and the single-use link token inside the message"],
            ["Send product news you asked for", "Email address, consent timestamp, consent source, consent text version, subscription status"],
            ["Operate the restricted AI product", "Conversations and messages, scoped to your account, only when you have access"],
            ["Protect the service from abuse", "Network address, per-address and per-IP request counters"],
            ["Diagnose faults and understand performance", "Route label, method, status, latency — no identifiers"],
          ],
        },
        {
          kind: "review",
          marker: "lawful-basis",
        },
      ],
    },
    {
      id: "cookies",
      heading: "Cookies and browser storage",
      blocks: [
        {
          kind: "p",
          text: "INFAIX sets one cookie. There is no second one, no storage in your browser beyond it, and no consent banner on this site — a banner offering to accept something optional would be misleading when nothing optional is used.",
        },
        {
          kind: "table",
          caption: "Every cookie and storage mechanism INFAIX uses",
          head: ["Name", "Purpose", "Type", "Lifespan"],
          rows: [
            [
              "infaix_session",
              "Keeps you signed in and protects against cross-site request forgery",
              "Strictly necessary — set only when you sign in, cannot be read by page scripts",
              "30 days from last use, refreshed while you stay signed in; cleared immediately when you sign out",
            ],
          ],
        },
        {
          kind: "p",
          text: "INFAIX uses no local storage, no session storage, no IndexedDB database, no service worker cache and no third-party script. The [[Cookie Policy|/legal/cookies]] describes this in full, including what happens if you block cookies.",
        },
        {
          kind: "review",
          marker: "consent-architecture",
        },
      ],
    },
    {
      id: "processors",
      heading: "Services that process INFAIX data",
      blocks: [
        {
          kind: "p",
          text: "Four external services are reachable from INFAIX Core's code. Only the ones you actually use are ever involved in your data.",
        },
        {
          kind: "table",
          caption: "Services and exactly what reaches them",
          head: ["Service", "Role", "Data it receives", "When"],
          rows: [
            [
              "Cloudflare",
              "Hosting, database, edge delivery",
              "Everything INFAIX stores, because it hosts the application and the database",
              "Whenever you use any part of the site",
            ],
            [
              "Resend",
              "Transactional email delivery",
              "Your email address and the verification or reset link in the message",
              "Only when INFAIX sends you an account message",
            ],
            [
              "INFAIX AI gateway",
              "Model access behind the AI product",
              "A short-lived signed assertion identifying you, plus the message you send in that conversation",
              "Only when you use INFAIX AI and have access",
            ],
            [
              "INFAIX Chat and Study",
              "Sign-in to a sibling INFAIX product",
              "A signed identity assertion containing an identifier, an audience, and issue and expiry times. No name, no email address, no profile",
              "Only when you choose to move to that product",
            ],
          ],
        },
        {
          kind: "fact",
          title: "No advertising or analytics vendors",
          text: "There is no data broker, advertising network, social pixel or analytics provider in this codebase. If a product that needs one is ever added, it will be listed here before it loads, and it will not load without agreement.",
        },
        {
          kind: "review",
          marker: "processors",
        },
        {
          kind: "review",
          marker: "transfers",
        },
      ],
    },
    {
      id: "retention",
      heading: "How long information is kept",
      blocks: [
        {
          kind: "p",
          text: "This is the part of a privacy policy that is most often fiction, so INFAIX states the mechanism rather than a comfortable number. Some lifetimes are enforced by the software. The rest are not yet decided, and the gap is listed for review rather than papered over.",
        },
        {
          kind: "h3",
          text: "Enforced by the system today",
        },
        {
          kind: "table",
          caption: "Lifetimes the software enforces",
          head: ["Data", "Current behaviour"],
          rows: [
            ["Session cookies in the browser", "Expire after 30 days of inactivity and refresh while in use. Cleared on sign-out."],
            ["Verification links", "Usable once, for 24 hours."],
            ["Password reset links", "Usable once, for 1 hour. Signing in afterwards signs out every existing session."],
            ["Invitation links", "Usable once, within a configurable period of 72 hours by default."],
            ["Sign-in state on a disabled account", "Cut immediately, including sessions that were already established."],
          ],
        },
        {
          kind: "h3",
          text: "Not yet decided",
        },
        {
          kind: "p",
          text: "There is currently no scheduled job that deletes accounts, audit records, spent tokens, expired sessions, newsletter records or AI conversations. They persist until a decision is made and the work is done. INFAIX would rather show you that gap than publish a retention schedule the system does not yet honour.",
        },
        {
          kind: "review",
          marker: "retention-accounts",
        },
        {
          kind: "review",
          marker: "retention-audit",
        },
        {
          kind: "review",
          marker: "retention-tokens",
        },
        {
          kind: "review",
          marker: "retention-sessions",
        },
        {
          kind: "review",
          marker: "retention-newsletter",
        },
        {
          kind: "review",
          marker: "retention-conversations",
        },
        {
          kind: "review",
          marker: "retention-logs",
        },
      ],
    },
    {
      id: "rights",
      heading: "Your rights and how to use them",
      blocks: [
        {
          kind: "h3",
          text: "What you can do yourself today",
        },
        {
          kind: "ul",
          items: [
            "See what INFAIX holds about your account: your display name, email address, verification state, account status, role and membership date are all shown in [[your account|/account]].",
            "Correct your display name from the same page.",
            "Change your password, which signs out your other sessions.",
            "Stop product news from the same page, under Email preferences. This does not affect account or security mail.",
            "Delete individual AI conversations if you have access to that product.",
            "Sign out at any time, which clears the session cookie immediately.",
          ],
        },
        {
          kind: "h3",
          text: "What does not exist yet",
        },
        {
          kind: "p",
          text: "There is no self-service account deletion control. That is a genuine gap rather than an oversight of documentation, and it is recorded below as a decision to be taken rather than a feature that exists.",
        },
        {
          kind: "review",
          marker: "erasure",
        },
        {
          kind: "review",
          marker: "access-requests",
        },
        {
          kind: "review",
          marker: "privacy-contact",
        },
        {
          kind: "h3",
          text: "Marketing and account mail are separate",
        },
        {
          kind: "p",
          text: "Account and security messages — verification, password reset, and password-change notices — exist because your account cannot work without them. They are sent regardless of your newsletter choice and are not marketing. Product news, launch announcements and similar updates are marketing, they are opt-in, and you can turn them off without affecting anything about your account.",
        },
        {
          kind: "review",
          marker: "marketing-unsubscribe",
        },
        {
          kind: "review",
          marker: "marketing-infrastructure",
        },
      ],
    },
    {
      id: "security",
      heading: "How INFAIX protects the information",
      blocks: [
        {
          kind: "p",
          text: "These are measures the software actually implements, not aspirations:",
        },
        {
          kind: "ul",
          items: [
            "Passwords are stretched with PBKDF2-SHA256 and a per-account salt, so a stolen database does not reveal them.",
            "Session tokens are random, stored only as a hash, signed with an HMAC so tampering is detectable, and are rotated on every sign-in.",
            "The session cookie is marked HttpOnly and Secure, and in production is scoped to the INFAIX domain with a SameSite policy that requires same-site requests.",
            "State-changing requests are checked against an allowlist of origins, which blocks cross-site request forgery.",
            "Sign-in, registration, verification and password reset are rate limited per network address, and the sensitive ones are limited per address as well.",
            "Failed sign-in attempts take the same time whether or not the account exists, so the form cannot be used to discover who has an account.",
            "Passwords, hashes and tokens are excluded from logs and audit records by construction, and the project's tests enforce that.",
            "The service tells browsers not to sniff content types and not to leak the full URL to other sites.",
          ],
        },
        {
          kind: "fact",
          title: "What INFAIX does not claim",
          text: "No system is perfectly secure. INFAIX does not promise that your data cannot ever be compromised, and does not claim any external security certification.",
        },
      ],
    },
    {
      id: "children",
      heading: "Children",
      blocks: [
        {
          kind: "p",
          text: "INFAIX is an engineering environment and is not directed at children. There is currently no age-verification step at signup, which means the age position has to be set deliberately rather than left implicit.",
        },
        {
          kind: "review",
          marker: "age",
        },
      ],
    },
    {
      id: "automated",
      heading: "Automated decisions",
      blocks: [
        {
          kind: "p",
          text: "INFAIX does not use your data to make automated decisions with legal or similarly significant effect, does not score you, and does not build a profile of your interests. Access to the restricted AI product is decided by an operator and is recorded as an access event; there is no algorithmic decision about you anywhere in the system.",
        },
      ],
    },
    {
      id: "changes",
      heading: "If this policy changes",
      blocks: [
        {
          kind: "p",
          text: "The version and date at the top of this page change whenever the text changes materially. Where a change affects what you agreed to, the version recorded against your newsletter consent is what tells INFAIX which text you actually saw.",
        },
        {
          kind: "p",
          text: "If INFAIX ever introduces something genuinely optional — analytics, for example — this page and the [[Cookie Policy|/legal/cookies]] will list it, and it will not run on your device until you agree to it.",
        },
      ],
    },
  ],
};