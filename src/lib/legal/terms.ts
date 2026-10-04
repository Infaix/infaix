/**
 * INFAIX Core — Terms of Use.
 *
 * The service status table is generated against the same application registry
 * the rest of the site uses, so the terms cannot drift away from what is
 * actually running. Provisions that depend on a business or legal decision
 * carry a `review` block instead of an invented term.
 */

import type { LegalBlock, LegalDocument } from "../legal-content";
import { INFAIX_APPS } from "../app-registry";
import { canLaunch } from "../app-contract";

/**
 * The service-status table is derived from the same registry that drives the
 * product directory, so these terms cannot quietly drift away from what is
 * actually running. If a product is disabled or launched, this table follows
 * on the next build rather than telling a reader something untrue.
 */
const SERVICE_NOTES: Record<string, string> = {
  core: "The site and account system described in these terms.",
  forge: "The technical creation environment and its published projects.",
  chat: "A separate service with its own terms. INFAIX Core hands you over through a signed assertion and stores no conversation there.",
  ai: "Restricted. Your account does not include it; an operator grants access separately.",
  shop: "Not operating. INFAIX does not currently sell anything, take payments or accept orders.",
  study: "Not operating. There is nothing to sign in to.",
  atlas: "Not operating. There is nothing to sign in to.",
};

function serviceState(app: (typeof INFAIX_APPS)[number]): string {
  if (app.status === "planned" || !canLaunch(app)) return "Planned";
  if (app.availability === "restricted") return "Live, access required";
  if (app.requiresAuth) return "Live, sign-in required";
  return "Live";
}

function serviceStatusTable(): LegalBlock {
  return {
    kind: "table",
    caption: "Service status as implemented",
    head: ["Service", "State", "What that means for you"],
    rows: INFAIX_APPS.map((app) => [
      app.name,
      serviceState(app),
      SERVICE_NOTES[app.id] ?? "See the product directory for its current description.",
    ]),
  };
}

export const termsOfUse: LegalDocument = {
  slug: "terms",
  label: "Terms",
  title: "Terms of Use",
  summary:
    "The agreement that comes with using INFAIX Core, written against what actually runs today.",
  version: "terms-2026-10-03",
  effective: "3 October 2026",
  sections: [
    {
      id: "agreement",
      heading: "The agreement",
      blocks: [
        {
          kind: "p",
          text: "These terms govern your use of INFAIX Core at [[infaix.com|/]] — the public site, the account system, and the products listed in [[Service status|/#service-status]]. By creating an account or using the site you accept them.",
        },
        {
          kind: "p",
          text: "If you do not accept them, do not create an account. If you have one and no longer accept them, close it — see [[Ending this agreement|/#termination]].",
        },
        {
          kind: "review",
          marker: "legal-entity",
        },
        {
          kind: "review",
          marker: "terms-governing-law",
        },
      ],
    },
    {
      id: "accounts",
      heading: "Accounts",
      blocks: [
        {
          kind: "p",
          text: "An INFAIX account is an identity. It is not a licence to use a product. Creating an account grants you exactly one thing: a verified identity that INFAIX products can recognise.",
        },
        {
          kind: "fact",
          title: "Signup grants nothing by itself",
          text: "Every public signup is created with member access, no AI access, and no product entitlement. Access to a restricted product is a separate, explicit act by an operator and is recorded as such.",
        },
        {
          kind: "h3",
          text: "What you agree to when you sign up",
        },
        {
          kind: "ul",
          items: [
            "You give accurate information and keep it accurate. Your email address must be one you actually control, and you must confirm it before you can sign in.",
            "You accept these terms and acknowledge the privacy policy. That acknowledgement is recorded with your account: which version of each document you accepted, that it happened at registration, and when. It is kept separately from your newsletter subscription, and it records no IP address or device information.",
            "You choose a password of at least 12 characters and you are responsible for keeping it. INFAIX stores only a one-way hash and cannot recover it for you.",
            "You are at least the minimum age set out below to hold an account.",
            "You do not share your account credentials, and you tell INFAIX if you think someone else has used them.",
            "One person, one account. Shared credentials break the security model that the audit log and rate limiting both depend on.",
          ],
        },
        {
          kind: "h3",
          text: "What INFAIX may do to an account",
        },
        {
          kind: "p",
          text: "An operator can disable an account, which removes access immediately — including from sessions that are already signed in. INFAIX also refuses sign-in to accounts whose email has not been verified.",
        },
        {
          kind: "review",
          marker: "terms-termination",
        },
        {
          kind: "review",
          marker: "legal-acceptance-retention",
        },
        {
          kind: "review",
          marker: "age",
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      blocks: [
        {
          kind: "p",
          text: "INFAIX builds infrastructure that other people depend on. The baseline below is drafted from what the service is for.",
        },
        {
          kind: "p",
          text: "You agree not to:",
        },
        {
          kind: "ul",
          items: [
            "Use the service for anything unlawful, or to facilitate harm to anyone.",
            "Attack, probe, overload or disrupt the service or anything it depends on, including by automating sign-in attempts or scraping.",
            "Attempt to gain access to an account, data or product that is not yours, or to bypass the access controls described on this site.",
            "Misrepresent who you are, or impersonate another person or organisation.",
            "Interfere with the service for other people, including by introducing malicious code or abusing a storage or rate limit.",
            "Reverse engineer, decompile or create derivative works from the service except where that restriction is prohibited by law.",
            "Use the AI product to generate unlawful material, to impersonate real people, or to build automated systems that cause harm at scale.",
            "Resell, sublicense or provide INFAIX as a service to third parties without written permission.",
          ],
        },
        {
          kind: "fact",
          title: "Abuse is rate limited, not just prohibited",
          text: "Sign-in, registration, verification and password reset are throttled per network address and, for the sensitive ones, per address. Attempts to work around those limits are themselves a breach of this section.",
        },
        {
          kind: "review",
          marker: "terms-acceptable-use",
        },
      ],
    },
    {
      id: "service-status",
      heading: "What INFAIX actually runs today",
      blocks: [
        {
          kind: "p",
          text: "INFAIX is a portfolio, and not everything in it is operating. This table is the same data the site's product directory uses, so it is the current truth rather than a description of intent.",
        },
        serviceStatusTable(),
        {
          kind: "fact",
          title: "INFAIX Shop is not a shop you can use",
          text: "Shop appears in the product directory as a planned project. Nothing on this site offers products for sale, and no such service is running. It is listed so the portfolio is honest, not so anyone expects a storefront.",
        },
        {
          kind: "p",
          text: "A service marked planned may launch, change or be withdrawn. A service marked beta or early access may change substantially or disappear without notice, and carries none of the commitments described in [[Availability|/#availability]].",
        },
        {
          kind: "review",
          marker: "ai-output-notice",
        },
        {
          kind: "review",
          marker: "product-terms",
        },
        {
          kind: "review",
          marker: "shop-commerce-compliance",
        },
        {
          kind: "review",
          marker: "terms-availability",
        },
      ],
    },
    {
      id: "availability",
      heading: "Availability",
      blocks: [
        {
          kind: "p",
          text: "INFAIX provides the site and the account system on a best-efforts basis. It aims to keep them running; it does not promise a particular uptime figure.",
        },
        {
          kind: "p",
          text: "Features may be added, changed or removed. Account and security behaviour described here — session lifetime, rate limits, token lifetimes — may change as the service changes.",
        },
        {
          kind: "fact",
          title: "What INFAIX will say when something breaks",
          text: "The operational console reports unavailable metrics as unavailable rather than as zero, and unknown health as unknown rather than as healthy. The same honesty applies here: INFAIX does not report a service as fine when it cannot see it.",
        },
        {
          kind: "review",
          marker: "terms-availability",
        },
      ],
    },
    {
      id: "your-content",
      heading: "Your content",
      blocks: [
        {
          kind: "p",
          text: "Where INFAIX hosts something you created — today, that means AI conversations and messages — you keep it. You are responsible for it, including for having the right to put it there.",
        },
        {
          kind: "ul",
          items: [
            "Conversations are stored against your account so they work across your sessions, and you can delete them individually at any time.",
            "INFAIX processes them to operate the AI product: to carry out the request and to return the response.",
            "You grant nothing beyond what is needed for that to work. No licence terms are asserted below, because the precise grant is a decision to make deliberately.",
          ],
        },
        {
          kind: "p",
          text: "You must not use INFAIX to store or transmit material you have no right to store or transmit, and you accept that automated systems may misread or misrepresent what you submit.",
        },
        {
          kind: "review",
          marker: "terms-ip",
        },
      ],
    },
    {
      id: "feedback",
      heading: "Feedback",
      blocks: [
        {
          kind: "p",
          text: "If you send INFAIX a suggestion, a bug report or other feedback, you accept that it may be used without restriction or payment. That is the general position only; the wording is still to be settled.",
        },
        {
          kind: "review",
          marker: "terms-ip",
        },
      ],
    },
    {
      id: "infaix-ip",
      heading: "INFAIX intellectual property",
      blocks: [
        {
          kind: "p",
          text: "INFAIX owns the INFAIX and FORGE names, the logo and marks, the design and visual language of this site, the source code, infrastructure and internal tooling, and the documentation on this site. None of that is licensed to you by these terms beyond the right to use the service.",
        },
        {
          kind: "p",
          text: "Third-party names, marks and open-source components remain the property of their owners and are used under their own licences. Projects published through [[FORGE|/forge]] may carry their own licences, stated per project.",
        },
        {
          kind: "review",
          marker: "terms-trademarks",
        },
      ],
    },
    {
      id: "third-party",
      heading: "Third-party services",
      blocks: [
        {
          kind: "p",
          text: "Parts of INFAIX link to services INFAIX does not operate, including INFAIX Chat, INFAIX Study and public source repositories. Those services are governed by their own terms, and INFAIX is not responsible for them.",
        },
        {
          kind: "p",
          text: "When you move between INFAIX products, INFAIX passes a short-lived signed assertion identifying your account. It contains an identifier, an intended audience, and issue and expiry times. It does not contain your name or your email address, and it cannot be used on any other product.",
        },
      ],
    },
    {
      id: "disclaimers",
      heading: "Disclaimers and liability",
      blocks: [
        {
          kind: "p",
          text: "INFAIX provides the service as it is. To the extent permitted by law, INFAIX does not promise that the service will be uninterrupted, error-free, or fit for a particular purpose.",
        },
        {
          kind: "p",
          text: "No liability cap, exclusion or carve-out has been written into these terms, because choosing one is a decision with commercial and legal consequences and should not be filled in by default. Nothing here should be read as a liability position until that decision is recorded.",
        },
        {
          kind: "review",
          marker: "terms-warranty",
        },
        {
          kind: "review",
          marker: "terms-liability",
        },
      ],
    },
    {
      id: "termination",
      heading: "Ending this agreement",
      blocks: [
        {
          kind: "p",
          text: "You can stop using INFAIX at any time and sign out. You can ask for your account to be closed.",
        },
        {
          kind: "p",
          text: "INFAIX can disable an account that breaks these terms or creates risk to the service or its users. Disabling cuts access immediately, including from live sessions.",
        },
        {
          kind: "p",
          text: "There is currently no self-service deletion control, and closing an account does not by itself erase the records described in the [[Privacy Policy|/legal/privacy]]. What happens to data after an account ends is a decision that has not yet been made.",
        },
        {
          kind: "review",
          marker: "terms-termination",
        },
        {
          kind: "review",
          marker: "retention-accounts",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      blocks: [
        {
          kind: "p",
          text: "These terms may change. The version and date at the top of this page identify the current text.",
        },
        {
          kind: "p",
          text: "If a change is material, INFAIX will give existing accounts notice through account or security mail before it takes effect. Changes that reduce a commitment or remove a capability will be called out specifically rather than buried in a reworded paragraph.",
        },
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [
        {
          kind: "p",
          text: "A working contact address for INFAIX has not been established in the product yet. The address that transactional account mail is sent from is not a monitored inbox, so it is not offered here as a contact route.",
        },
        {
          kind: "review",
          marker: "privacy-contact",
        },
        {
          kind: "review",
          marker: "legal-entity",
        },
      ],
    },
  ],
};