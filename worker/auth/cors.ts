// CORS + CSRF origin model for the API.
//
// Because the production session cookie is cross-subdomain
// (Domain=.infaix.com, SameSite=None), CORS and origin checks — not
// SameSite — carry the cross-site weight:
//
// - CORS: explicit allowlist only (https://infaix.com, https://ai.infaix.com,
//   the Worker's own origin, plus localhost in non-production). Credentials
//   allowed; wildcard and origin reflection are never used.
// - CSRF: every state-changing /api/* request (POST/PUT/PATCH/DELETE) must
//   carry a present, allowlisted Origin or Referer. Absent headers fail
//   closed. GET stays read-only and needs no origin check (CORS still
//   governs readability).
import type { Env } from "./types";

const PRODUCTION_ORIGINS = ["https://infaix.com", "https://ai.infaix.com"];

export function allowedOrigins(env: Env, workerOrigin: string): string[] {
  const list = new Set<string>([workerOrigin, ...PRODUCTION_ORIGINS]);
  const extra = (env.CORS_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  for (const o of extra) {
    // Extra origins must be https in production; localhost http is a
    // development-only convenience and is rejected in production.
    if (o.startsWith("https://")) list.add(o);
    else if (env.ENVIRONMENT !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) list.add(o);
  }
  if (env.ENVIRONMENT !== "production") {
    // Local dev servers run on arbitrary ports; match any localhost port.
    return [...list, "LOCALHOST_WILDCARD"];
  }
  return [...list];
}

function originMatches(allowed: string[], origin: string): boolean {
  if (allowed.includes(origin)) return true;
  if (allowed.includes("LOCALHOST_WILDCARD") && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

/** The validated request origin, or null when cross-origin use is denied. */
export function validatedCorsOrigin(req: Request, env: Env, workerOrigin: string): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const allowed = allowedOrigins(env, workerOrigin);
  return originMatches(allowed, origin) ? origin : null;
}

/** CORS headers for actual API responses. Empty when the origin is denied. */
export function corsHeaders(req: Request, env: Env, workerOrigin: string): Record<string, string> {
  const origin = validatedCorsOrigin(req, env, workerOrigin);
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    vary: "Origin",
  };
}

/** CORS preflight for /api/*. Returns a Response, or null if not preflight. */
export function handlePreflight(req: Request, env: Env, workerOrigin: string): Response | null {
  if (req.method.toUpperCase() !== "OPTIONS" || !new URL(req.url).pathname.startsWith("/api/")) return null;
  const origin = validatedCorsOrigin(req, env, workerOrigin);
  if (!origin) return new Response("Forbidden", { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-admin-token, x-request-id",
      "access-control-max-age": "86400",
      vary: "Origin",
    },
  });
}

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF gate for state-changing API requests. Requires a present,
 * allowlisted Origin (preferred) or Referer. Unlike the old same-origin
 * check, cross-subdomain calls from ai.infaix.com pass while unrelated
 * origins — and headerless requests — fail closed.
 */
export function checkRequestOrigin(req: Request, env: Env, workerOrigin: string): boolean {
  if (!STATE_CHANGING.has(req.method.toUpperCase())) return true;
  const allowed = allowedOrigins(env, workerOrigin);
  const origin = req.headers.get("origin");
  if (origin) return originMatches(allowed, origin);
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return originMatches(allowed, new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return false;
}
