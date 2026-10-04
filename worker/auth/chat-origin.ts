// Allowlisted Chat origins for the identity handoff.
//
// Every origin in this list is a trusted RECIPIENT of a signed production
// identity assertion minted by /api/auth/chat, so the list itself is a
// security boundary. The deployment environment decides which declaration is
// read, because only the operator knows which deployments are production:
//
// - production reads CHAT_PRODUCTION_EXTRA_ORIGINS only.
//   CHAT_EXTRA_ORIGINS is a development-deployment variable and is ignored
//   outright when ENVIRONMENT === "production". A dev or preview Worker on a
//   shared *.workers.dev domain therefore cannot become a trusted assertion
//   recipient in production, even if it is reachable and even if someone
//   commits it to the production config.
// - non-production may list additional origins through CHAT_EXTRA_ORIGINS.
//
// This is deliberately a declaration split, not a hostname heuristic: nothing
// here infers trust from a name that looks like production.
//
// Every origin must be a strict https origin, and any malformed value fails
// the whole list closed. A forged Host header can never select an external
// callback.
import type { Env } from "./types";

function strictHttpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.origin !== value ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Primary Chat origin plus environment-scoped extras. Any malformed value
 * fails closed.
 */
export function configuredChatOrigins(env: Env): string[] | null {
  const primary = strictHttpsOrigin(env.CHAT_ORIGIN);
  if (!primary) return null;
  const declaration =
    env.ENVIRONMENT === "production" ? env.CHAT_PRODUCTION_EXTRA_ORIGINS : env.CHAT_EXTRA_ORIGINS;
  const extras = (declaration ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const origins = [primary];
  for (const extra of extras) {
    const parsed = strictHttpsOrigin(extra);
    if (!parsed) return null;
    if (!origins.includes(parsed)) origins.push(parsed);
  }
  return origins;
}
