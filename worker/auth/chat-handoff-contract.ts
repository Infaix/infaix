/**
 * Core → Chat identity handoff protocol.
 *
 * Protocol-level values (algorithm, issuer, TTL, claim list, failure codes) are
 * re-exported from the shared handoff contract so Chat and Study are guaranteed
 * to speak the same protocol. The audience stays product-specific and is declared
 * here, because the audience is the security boundary between products.
 *
 * Chat's verifier in its own repository must not import from here: production
 * builds clone Core alone. It is expected to accept only this shape and to
 * report the failure codes below.
 */
export {
  HANDOFF_ALGORITHM as CHAT_HANDOFF_ALGORITHM,
  HANDOFF_TYPE as CHAT_HANDOFF_TYPE,
  HANDOFF_ISSUER as CHAT_HANDOFF_ISSUER,
  HANDOFF_TTL_SEC as CHAT_HANDOFF_TTL_SEC,
  HANDOFF_CLAIMS as CHAT_HANDOFF_CLAIMS,
  HANDOFF_FAILURE_CODES as CHAT_HANDOFF_FAILURE_CODES,
} from "./handoff-contract";

/** Audience a token must carry to be redeemable by Chat. */
export const CHAT_HANDOFF_AUDIENCE = "infaix-chat";
