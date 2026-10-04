/**
 * The outstanding-items checklist, grouped so a reviewer can work through it in
 * one sitting.
 *
 * Lives outside the page component so it can be tested in Node without pulling
 * in React or the navigation. `tests/legal-content.test.ts` asserts that these
 * groups partition the marker set exactly, so an item added later cannot
 * quietly fail to appear in the checklist.
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
      "legal-acceptance-retention",
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
    title: "Controls that do not exist yet",
    note: "Product gaps. They are listed as gaps rather than shipped as controls that do nothing.",
    ids: ["erasure", "data-export", "access-requests", "marketing-unsubscribe"],
  },
  {
    title: "Communications and consent",
    note: "What people can do for themselves today, and what still needs a channel or a decision.",
    ids: ["marketing-infrastructure", "consent-architecture"],
  },
  {
    title: "Terms that need drafting decisions",
    note: "Provisions that cannot be written honestly without a commercial or legal choice.",
    ids: [
      "terms-termination",
      "terms-liability",
      "terms-warranty",
      "terms-ip",
      "terms-trademarks",
      "terms-availability",
      "terms-governing-law",
      "terms-acceptable-use",
      "ai-output-notice",
      "product-terms",
      "shop-commerce-compliance",
    ],
  },
];
