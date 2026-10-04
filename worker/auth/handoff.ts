// Core → product identity handoff route handler.
//
// One implementation, parameterised by audience, origin allowlist, signing key
// and the product's own callback path. The audience is the security boundary: a
// token minted for one product cannot be redeemed by another, even though the
// same key pair signs both.
//
// A caller can never choose where the assertion is delivered: `return_to` must
// resolve to an allowlisted product origin, and a redirect to anything else is
// rejected before the user's session is even consulted.

import { verifySession } from "./sessions";
import { mintServiceAssertion } from "./service-assertion";
import { validateHandoffContinuation } from "./continuation";
import type { HandlerContext, HandlerResult } from "./handlers";

export interface HandoffConfig {
  /** Stable audience, e.g. "infaix-chat". */
  audience: string;
  /** Allowlisted origins, or null when the product is not configured. */
  origins: string[] | null;
  /** PKCS8 PEM of the signing key. */
  privateKey: string | undefined;
  /** Default callback path on the product origin. */
  defaultCallbackPath: string;
  /** Human-readable product name, used in error messages only. */
  productLabel: string;
}

export async function handleHandoff(
  ctx: HandlerContext,
  req: Request,
  url: URL,
  config: HandoffConfig
): Promise<HandlerResult> {
  const unavailable = (): HandlerResult => ({
    status: 503,
    body: { error: { code: "AUTH_UNAVAILABLE", message: `${config.productLabel} identity handoff is not configured.` } },
  });

  if (!config.origins) return unavailable();

  const parsed = validateHandoffContinuation(url, config.origins, config.defaultCallbackPath);
  if (!parsed) return invalidRedirect();

  const session = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (!session) {
    // Not signed in to Core: send the visitor to Core's own login, which
    // decides where they land afterwards.
    const login = new URL("/login", url.origin);
    login.searchParams.set("returnTo", `${url.pathname}${url.search}`);
    return {
      status: 302,
      body: null,
      headers: { location: `${login.pathname}${login.search}`, "cache-control": "no-store" },
    };
  }

  if (!config.privateKey) return unavailable();
  const assertion = await mintServiceAssertion(config.privateKey, config.audience, session.user);
  parsed.searchParams.set("assertion", assertion);
  return {
    status: 302,
    body: null,
    headers: { location: parsed.toString(), "cache-control": "no-store" },
  };
}

function invalidRedirect(): HandlerResult {
  return {
    status: 400,
    body: { error: { code: "INVALID_REDIRECT", message: "Invalid return destination." } },
  };
}
