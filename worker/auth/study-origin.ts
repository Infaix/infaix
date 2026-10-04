// Allowlisted Study origins for the identity handoff.
//
// Mirrors chat-origin.ts: the primary origin must be a strict https origin and
// any malformed extra fails the whole list closed. A forged Host header can
// never select an external callback.
//
// Environment decides which extras declaration is read. STUDY_EXTRA_ORIGINS is
// development-only and is ignored outright in production, so a preview Worker
// can never become a trusted recipient of a production identity assertion.

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
 * Primary Study origin plus environment-scoped extras. Any malformed value
 * fails closed.
 */
export function configuredStudyOrigins(env: Env): string[] | null {
  const primary = strictHttpsOrigin(env.STUDY_ORIGIN);
  if (!primary) return null;
  const declaration =
    env.ENVIRONMENT === "production" ? env.STUDY_PRODUCTION_EXTRA_ORIGINS : env.STUDY_EXTRA_ORIGINS;
  const extras = (declaration ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const origins = [primary];
  for (const extra of extras) {
    const parsed = strictHttpsOrigin(extra);
    if (!parsed) return null;
    if (!origins.includes(parsed)) origins.push(parsed);
  }
  return origins;
}
