// Core → product identity handoff protocol.
//
// Core mints the assertion. Each product verifies it in its own repository and
// must not import from here: production builds clone Core alone. Verifiers are
// expected to accept only this shape and to report the failure codes below.
//
// The protocol is audience-bound, so one key pair can serve every product while
// a token minted for Chat can never be redeemed by Study (or vice versa).

export const HANDOFF_ALGORITHM = "RS256" as const;
export const HANDOFF_TYPE = "JWT" as const;
export const HANDOFF_ISSUER = "infaix-core";
export const HANDOFF_TTL_SEC = 90;

/** Claims Core puts on the assertion. No profile, session, or secret material. */
export const HANDOFF_CLAIMS = ["iss", "aud", "sub", "iat", "exp", "jti"] as const;

export const HANDOFF_FAILURE_CODES = [
  "HANDOFF_KEY_IMPORT_FAILED",
  "HANDOFF_SIGNATURE_INVALID",
  "HANDOFF_ISSUER_INVALID",
  "HANDOFF_AUDIENCE_INVALID",
  "HANDOFF_EXPIRED",
  "HANDOFF_SUBJECT_INVALID",
  "HANDOFF_JTI_INVALID",
  "HANDOFF_ASSERTION_INVALID",
] as const;
