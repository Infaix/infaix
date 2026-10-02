/**
 * Core → Chat identity handoff protocol.
 *
 * Core mints the assertion. Chat verifies it in its own repository and must
 * not be imported from here: production builds clone Core alone.
 * Chat's verifier is expected to accept only this shape and to report the
 * failure codes below.
 */
export const CHAT_HANDOFF_ALGORITHM = "RS256" as const;
export const CHAT_HANDOFF_TYPE = "JWT" as const;
export const CHAT_HANDOFF_ISSUER = "infaix-core";
export const CHAT_HANDOFF_AUDIENCE = "infaix-chat";
export const CHAT_HANDOFF_TTL_SEC = 90;

/** Claims Core puts on the assertion. No profile, session, or secret material. */
export const CHAT_HANDOFF_CLAIMS = ["iss", "aud", "sub", "iat", "exp", "jti"] as const;

export const CHAT_HANDOFF_FAILURE_CODES = [
  "HANDOFF_KEY_IMPORT_FAILED",
  "HANDOFF_SIGNATURE_INVALID",
  "HANDOFF_ISSUER_INVALID",
  "HANDOFF_AUDIENCE_INVALID",
  "HANDOFF_EXPIRED",
  "HANDOFF_SUBJECT_INVALID",
  "HANDOFF_JTI_INVALID",
  "HANDOFF_ASSERTION_INVALID",
] as const;
