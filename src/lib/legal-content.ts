/**
 * Legal & trust content model for INFAIX Core.
 *
 * Every statement in the legal documents is traceable to this repository:
 * the Worker (`worker/`), the D1 migrations (`db/migrations/`), the rendered
 * site (`src/`), or the Phase 1/2 contracts in `docs/`. Nothing is inferred
 * from production systems, and nothing that the codebase does not establish is
 * asserted as fact.
 *
 * Where a fact is a business or legal decision rather than an implementation
 * fact, the document carries a `review` block instead of an invented value,
 * and the question is listed in `REVIEW_MARKERS`. The legal centre renders
 * that list as the outstanding-decisions checklist.
 *
 * Pure data module: no components, no network, no side effects.
 */

export interface ReviewMarker {
  /** Stable id referenced by `review` blocks in the documents. */
  id: string;
  topic: string;
  /** The question that has to be answered before this text can be final. */
  question: string;
  /** What the code does today, so the decision is informed. */
  current: string;
}

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; caption: string; head: string[]; rows: string[][] }
  | { kind: "fact"; title: string; text: string }
  | { kind: "review"; marker: string };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: string;
  /** Shown as the eyebrow above the document title. */
  label: string;
  title: string;
  /** One plain sentence for the legal centre index. */
  summary: string;
  /** The document's own version. Newsletter consent records this version. */
  version: string;
  /** ISO date this text was last changed. */
  effective: string;
  sections: LegalSection[];
}

/**
 * Everything the legal documents deliberately do not decide.
 *
 * `current` describes the implementation as it stands today so the decision
 * can be made without re-reading the code. Nothing in this list is a defect:
 * it is work that belongs to the owner and to counsel, not to the frontend.
 */
export const REVIEW_MARKERS: ReviewMarker[] = [
  {
    id: "legal-entity",
    topic: "Identity of the entity",
    question: "What is the full legal name of the entity that operates infaix.com, and what is its registered address?",
    current: "No legal entity, company number or address appears anywhere in this repository. The site identifies itself only as the INFAIX brand.",
  },
  {
    id: "privacy-contact",
    topic: "Privacy contact channel",
    question: "Which email address and postal address receive privacy requests, and who is the named data protection contact?",
    current: "Transactional mail is sent from noreply@infaix.com, which by name is not a monitored inbox. No monitored address exists in the repository.",
  },
  {
    id: "lawful-basis",
    topic: "Lawful basis",
    question: "For each processing purpose, which lawful basis applies, and is consent required for any of them?",
    current: "The implementation records what it does but not why it is lawful. Account creation relies on the person performing the act; newsletter consent is explicitly recorded as a consent event.",
  },
  {
    id: "regime",
    topic: "Applicable regime",
    question: "Is INFAIX subject to the GDPR / UK GDPR, and if so which regulator is the lead supervisory authority?",
    current: "Unknown, and it depends on the entity and its establishment. The copy below is deliberately regime-neutral.",
  },
  {
    id: "transfers",
    topic: "International transfers",
    question: "In which countries are the hosting, database, email and AI services located, and what transfer mechanism covers them?",
    current: "The code names the providers but stores no region, transfer mechanism or adequacy decision. A Cloudflare Workers/D1 account and a Resend account each resolve to a real region once created.",
  },
  {
    id: "processors",
    topic: "Processors and sub-processors",
    question: "Which organisations are formally engaged as processors, under what written terms, and are they listed anywhere public?",
    current: "Four services are reachable from the code: Cloudflare (hosting, database, edge), Resend (transactional email), an AI gateway behind AI_GATEWAY_URL, and the sibling Chat and Study products reached by signed handoff. Contract status is not recorded here.",
  },
  {
    id: "terms-acceptance-record",
    topic: "Recording acceptance",
    question: "Should acceptance of these terms be stored server-side, and if so as a version, a timestamp, or both?",
    current: "Signup requires an unticked acknowledgement that names the exact document versions, and refuses to submit without it. Nothing is written to the account row: the registration contract has no field for it, and the audit log records account creation rather than which text was accepted.",
  },
  {
    id: "age",
    topic: "Minimum age",
    question: "What is the minimum age to hold an INFAIX account, and is an age assurance step required at signup?",
    current: "There is no age gate in the signup flow. Any person with a deliverable email address and a valid invitation-free signup can currently create an account.",
  },
  {
    id: "retention-accounts",
    topic: "Retention: account data",
    question: "How long is account data kept after an account is closed, and what happens to it on deletion?",
    current: "There is no account deletion endpoint and no deletion job. Disabling an account cuts access immediately but leaves the row in place.",
  },
  {
    id: "retention-audit",
    topic: "Retention: audit log",
    question: "How long are security and audit events retained?",
    current: "audit_log rows have no expiry and no pruning job. They are the evidence base for incidents and for account recovery, so the period is a real risk trade-off.",
  },
  {
    id: "retention-tokens",
    topic: "Retention: single-use tokens",
    question: "How long are spent invitations, password resets and email verification rows kept?",
    current: "Consumed and expired token rows are status-flagged rather than deleted. There is no cleanup job.",
  },
  {
    id: "retention-sessions",
    topic: "Retention: sessions and counters",
    question: "How long do expired sessions and rate-limit counters remain in the database?",
    current: "Sessions carry a 30-day sliding expiry and the schema is indexed for expiry pruning, but no scheduled job performs it. Rate-limit counters are equally unpruned.",
  },
  {
    id: "retention-newsletter",
    topic: "Retention: newsletter records",
    question: "How long are newsletter consent records retained, including records of people who unsubscribed?",
    current: "Unsubscribing is a status change; the row is deliberately kept as a consent audit trail. The retention period for that trail is undecided.",
  },
  {
    id: "retention-conversations",
    topic: "Retention: AI conversations",
    question: "How long are AI conversations and messages kept, and is there a default deletion period?",
    current: "Conversations are scoped to the signed-in account and can be deleted one at a time through the product. There is no automatic expiry.",
  },
  {
    id: "retention-logs",
    topic: "Retention: platform logs",
    question: "What log retention is configured at the Cloudflare edge, and does it match the audit and account retention decisions?",
    current: "Application logs are structured records written to the Worker log stream with no configured retention. Edge log retention lives in the Cloudflare dashboard and is not visible from the repository.",
  },
  {
    id: "erasure",
    topic: "Erasure requests",
    question: "How does someone request deletion of their data, and what is the response time?",
    current: "There is no self-service deletion control anywhere in the product. Until one exists, a request can only be handled manually.",
  },
  {
    id: "access-requests",
    topic: "Access and rectification requests",
    question: "What is the channel and deadline for a formal access or rectification request, distinct from using the product's own controls?",
    current: "The account page shows the stored profile and allows the display name to be corrected, which covers everyday use but is not a formal request mechanism.",
  },
  {
    id: "marketing-unsubscribe",
    topic: "Unsubscribing without an account",
    question: "How does someone who subscribed with only an email address — and never made an account — unsubscribe?",
    current: "Withdrawal is available to signed-in accounts from account preferences. A public, token-gated unsubscribe link is deliberately not implemented yet, because an ungated endpoint would let anyone remove anyone.",
  },
  {
    id: "marketing-infrastructure",
    topic: "Marketing send infrastructure",
    question: "Which provider sends the newsletter, what is the double opt-in confirmation flow, and what is the sending frequency promise?",
    current: "Consent is recorded and stored as PENDING_CONFIRMATION, but no confirmation link and no marketing send path exist yet. Nothing is being sent. The transactional mailer is deliberately not reused for marketing.",
  },
  {
    id: "consent-architecture",
    topic: "Consent architecture for optional technology",
    question: "If analytics or any other non-essential technology is ever introduced, what consent gate and which prior blocking are required before it loads?",
    current: "There are no analytics, advertising or tracking scripts in the codebase, and no consent state is stored in the browser. Nothing is gated because nothing optional is loaded.",
  },
  {
    id: "terms-termination",
    topic: "Termination and suspension",
    question: "What are the notice periods and the grounds for suspending or terminating an account, and what happens to the account's data?",
    current: "An administrator can disable an account, which removes access immediately, including from live sessions. There is no notice mechanism and no deletion step.",
  },
  {
    id: "terms-liability",
    topic: "Limitation of liability",
    question: "What liability cap and what exclusions apply, and do any carve-outs for consumer law or wilful misconduct have to be preserved?",
    current: "No liability position exists in the code. Nothing has been written into the terms on this point because a cap must be chosen deliberately, not defaulted.",
  },
  {
    id: "terms-warranty",
    topic: "Warranty disclaimer",
    question: "How far can INFAIX disclaim fitness and availability, and which statutory warranties cannot be disclaimed?",
    current: "Several products in the ecosystem are marked planned and beta. The disclaimer below states the general position and is marked for review rather than hardened.",
  },
  {
    id: "terms-ip",
    topic: "Intellectual property and user content",
    question: "What licence, if any, is granted over content submitted to INFAIX products, and is the licence exclusive, perpetual or royalty-free?",
    current: "AI conversations are stored against the signed-in account so the product can work. No licence grant or feedback-licence term is implemented anywhere.",
  },
  {
    id: "terms-trademarks",
    topic: "Trademarks and brand use",
    question: "Is there a trademark policy restricting use of the INFAIX and FORGE names and marks?",
    current: "The brand and its marks are owned by INFAIX. No permitted-use or restricted-use list is defined.",
  },
  {
    id: "terms-availability",
    topic: "Availability commitments",
    question: "Is there any service level commitment for live products, and is it clearly separated from planned and beta products?",
    current: "Live products carry no uptime promise anywhere in the codebase. Planned products have no availability at all.",
  },
  {
    id: "terms-governing-law",
    topic: "Governing law and forum",
    question: "Which law governs these terms, and which courts have jurisdiction?",
    current: "Unknown. It follows from the entity decision, so nothing has been written in.",
  },
  {
    id: "terms-acceptable-use",
    topic: "Acceptable use detail",
    question: "Is there a separate acceptable use or AI usage policy, and should it be incorporated here or published separately?",
    current: "No automated use policy exists. The section below states a baseline drafted from the service's purpose and is marked for review.",
  },
  {
    id: "product-terms",
    topic: "Product-specific terms",
    question: "Will Study, Atlas and Shop carry their own terms when they launch, or do these terms cover them?",
    current: "All three are planned and not operating. INFAIX Shop in particular is not a working service and nothing on this site invites anyone to buy from it.",
  },
];

/**
 * Inline link syntax understood by the renderer: `[[label|/path]]` for a
 * route on this site, `[[label|https://…]]` for an external destination.
 * Keeping links as text means the whole document stays scannable, diffable and
 * assertable in tests.
 */
export const LEGAL_LINK = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

export interface LegalLinkToken {
  label: string;
  href: string;
}

export function splitLegalText(text: string): (string | LegalLinkToken)[] {
  const out: (string | LegalLinkToken)[] = [];
  let cursor = 0;
  for (const match of text.matchAll(LEGAL_LINK)) {
    const start = match.index ?? 0;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push({ label: match[1], href: match[2] });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function markerById(id: string): ReviewMarker | undefined {
  return REVIEW_MARKERS.find((m) => m.id === id);
}

/** Ids referenced by at least one document, in document order. */
export function referencedMarkerIds(documents: LegalDocument[]): string[] {
  const ids: string[] = [];
  for (const doc of documents) {
    for (const section of doc.sections) {
      for (const block of section.blocks) {
        if (block.kind === "review" && !ids.includes(block.marker)) ids.push(block.marker);
      }
    }
  }
  return ids;
}