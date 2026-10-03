/**
 * The outstanding-decisions checklist, grouped so a reviewer can work through
 * it in one sitting.
 *
 * Lives outside the page component so it can be tested in Node without
 * pulling in React or the navigation. `tests/legal-content.test.ts` asserts
 * that these groups partition the marker set exactly, so a decision added
 * later cannot quietly fail to appear in the checklist.
 */

export interface DecisionGroup {
  title: string;
  note: string;
  ids: string[];
}

export const DECISION_GROUPS: readonly DecisionGroup[] = [
  {
    title: "Who INFAIX is, and who to ask",
    note: "Nothing below is answered in the published documents, because nothing in the codebase answers it.",
    ids: ["legal-entity", "privacy-contact", "regime", "lawful-basis", "transfers", "processors", "age"],
  },
  {
    title: "How long data is kept",
    note: "The system has no deletion jobs today. These are the periods that still need choosing.",
    ids: [
      "retention-accounts",
      "retention-audit",
      "retention-tokens",
      "retention-sessions",
      "retention-newsletter",
      "retention-conversations",
      "retention-logs",
    ],
  },
  {
    title: "Rights, requests and consent",
    note: "What people can do for themselves today, and what still needs a channel and a deadline.",
    ids: ["erasure", "access-requests", "marketing-unsubscribe", "marketing-infrastructure", "consent-architecture"],
  },
  {
    title: "Terms that need drafting decisions",
    note: "Provisions that cannot be written honestly without a commercial or legal choice.",
    ids: [
      "terms-termination",
      "terms-acceptance-record",
      "terms-liability",
      "terms-warranty",
      "terms-ip",
      "terms-trademarks",
      "terms-availability",
      "terms-governing-law",
      "terms-acceptable-use",
      "product-terms",
    ],
  },
];