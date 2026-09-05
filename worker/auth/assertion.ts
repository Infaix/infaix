// AI gateway assertions: short-lived jose-signed (HS256) tokens that let
// the main INFAIX Worker prove user identity to ai.infaix.com without ever
// sharing sessions, cookies, or SESSION_SECRET. The browser never sees them.
//
// Canonical request binding (must match the InfaixAI gateway exactly):
//   req = sha256hex( METHOD + "\n" + PATH + "\n" + sha256hex(bodyBytes) )
// where METHOD is uppercase (e.g. "POST"), PATH is the gateway path
// (e.g. "/chat"), and bodyBytes are the exact bytes forwarded upstream.
import { jwtVerify, SignJWT } from "jose";
import { newId, sha256Hex, sha256HexBytes } from "./crypto";
import type { Role } from "./types";

export const ASSERTION_ISSUER = "infaix-worker";
export const ASSERTION_AUDIENCE = "ai.infaix.com";
export const ASSERTION_TTL_SEC = 90;
const CLOCK_TOLERANCE_SEC = 5;

export interface AssertionClaims {
  sub: string;
  role: Role;
  ai_access: boolean;
  req: string;
  jti: string;
}

const VALID_ROLES: Role[] = ["OWNER", "ADMIN", "USER"];

export function gatewaySecrets(env: { AI_GATEWAY_SECRET?: string; AI_GATEWAY_SECRET_PREVIOUS?: string }): {
  current: Uint8Array | null;
  previous: Uint8Array | null;
} {
  const enc = new TextEncoder();
  const clean = (s: string | undefined): Uint8Array | null =>
    s && s.length >= 32 ? enc.encode(s) : null;
  return { current: clean(env.AI_GATEWAY_SECRET), previous: clean(env.AI_GATEWAY_SECRET_PREVIOUS) };
}

/** Canonical binding over the exact upstream request. */
export async function requestBinding(method: string, path: string, body: Uint8Array): Promise<string> {
  const bodyHash = await sha256HexBytes(body);
  return sha256Hex(`${method.toUpperCase()}\n${path}\n${bodyHash}`);
}

export interface MintOptions {
  secret: Uint8Array;
  audience?: string;
  userId: string;
  role: Role;
  aiAccess: boolean;
  reqBinding: string;
  nowSec?: number;
  ttlSec?: number;
}

export async function mintAiAssertion(opts: MintOptions): Promise<string> {
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: opts.userId,
    role: opts.role,
    ai_access: opts.aiAccess,
    req: opts.reqBinding,
    jti: newId("jti"),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ASSERTION_ISSUER)
    .setAudience(opts.audience ?? ASSERTION_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + (opts.ttlSec ?? ASSERTION_TTL_SEC))
    .sign(opts.secret);
}

export type VerifyError =
  | "MISSING_TOKEN"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "WRONG_AUDIENCE"
  | "WRONG_ISSUER"
  | "MISSING_CLAIMS"
  | "BINDING_MISMATCH";

export interface VerifyOptions {
  token: string;
  secrets: { current: Uint8Array | null; previous: Uint8Array | null };
  audience?: string;
  expectedReqBinding?: string;
  nowSec?: number;
}

export async function verifyAiAssertion(
  opts: VerifyOptions
): Promise<{ ok: true; claims: AssertionClaims } | { ok: false; error: VerifyError }> {
  if (!opts.token) return { ok: false, error: "MISSING_TOKEN" };
  const audience = opts.audience ?? ASSERTION_AUDIENCE;
  const candidates = [opts.secrets.current, opts.secrets.previous].filter((s): s is Uint8Array => !!s);
  if (!candidates.length) return { ok: false, error: "INVALID_SIGNATURE" };

  let payload: Record<string, unknown> | null = null;
  let verified = false;
  let failureCode = "";
  for (const secret of candidates) {
    try {
      const { payload: p } = await jwtVerify(opts.token, secret, {
        issuer: ASSERTION_ISSUER,
        audience,
        clockTolerance: CLOCK_TOLERANCE_SEC,
        currentDate: opts.nowSec !== undefined ? new Date(opts.nowSec * 1000) : undefined,
      });
      payload = p as Record<string, unknown>;
      verified = true;
      break;
    } catch (e) {
      const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
      failureCode = code;
      if (code === "ERR_JWT_EXPIRED") break; // no other secret will help
    }
  }
  if (!verified || !payload) {
    if (failureCode === "ERR_JWT_EXPIRED") return { ok: false, error: "EXPIRED" };
    // jose merges audience/issuer failures into claim-validation errors;
    // distinguish by peeking at the unverified payload (classification only).
    const audErr = await probeClaim(opts.token, "aud", audience);
    if (audErr) return { ok: false, error: audErr };
    const issErr = await probeClaim(opts.token, "iss", ASSERTION_ISSUER);
    if (issErr) return { ok: false, error: issErr };
    return { ok: false, error: "INVALID_SIGNATURE" };
  }

  const { sub, role, ai_access, req, jti } = payload;
  if (
    typeof sub !== "string" || !sub ||
    typeof role !== "string" || !(VALID_ROLES as string[]).includes(role) ||
    typeof ai_access !== "boolean" ||
    typeof req !== "string" || !req ||
    typeof jti !== "string" || !jti
  ) {
    return { ok: false, error: "MISSING_CLAIMS" };
  }
  if (opts.expectedReqBinding !== undefined && req !== opts.expectedReqBinding) {
    return { ok: false, error: "BINDING_MISMATCH" };
  }
  return { ok: true, claims: { sub, role: role as Role, ai_access, req, jti } };
}

/** Unverified payload peek used only to classify aud/iss mismatches. */
async function probeClaim(token: string, claim: "aud" | "iss", expected: string): Promise<VerifyError | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const v = (json as Record<string, unknown>)[claim];
    const values = Array.isArray(v) ? v : [v];
    if (!values.includes(expected)) return claim === "aud" ? "WRONG_AUDIENCE" : "WRONG_ISSUER";
    return null;
  } catch {
    return null;
  }
}
