/**
 * The legal centre's document set.
 *
 * One import surface so the index page, the footer and any future reference
 * to a document resolve against the same source, and a document can never be
 * linked from the navigation without existing.
 */

import type { LegalDocument } from "./legal-content";
import { cookiePolicy } from "./legal/cookies";
import { privacyPolicy } from "./legal/privacy";
import { termsOfUse } from "./legal/terms";

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  privacyPolicy,
  termsOfUse,
  cookiePolicy,
];

export interface LegalNavEntry {
  href: string;
  label: string;
}

export const LEGAL_LINKS: readonly LegalNavEntry[] = LEGAL_DOCUMENTS.map((doc) => ({
  href: `/legal/${doc.slug}`,
  label: doc.title,
}));

export function legalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug);
}