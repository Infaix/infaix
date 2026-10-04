// Server-owned legal versions. The client must acknowledge these exact
// identifiers; it cannot name a different policy or invent a source.
import { PRIVACY_VERSION, TERMS_VERSION } from "../../src/lib/legal-versions";

export const LEGAL_ACCEPTANCE_SOURCE = "registration" as const;

export const CURRENT_TERMS_VERSION = TERMS_VERSION;
export const CURRENT_PRIVACY_VERSION = PRIVACY_VERSION;

export function acceptedCurrentLegal(body: Record<string, unknown> | null): boolean {
  const legal = body?.legal;
  if (typeof legal !== "object" || legal === null || Array.isArray(legal)) return false;
  const row = legal as Record<string, unknown>;
  return row.accepted === true && row.termsVersion === CURRENT_TERMS_VERSION && row.privacyVersion === CURRENT_PRIVACY_VERSION;
}
