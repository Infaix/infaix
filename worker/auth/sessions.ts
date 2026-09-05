// Session management: opaque random tokens, SHA-256 hashes at rest,
// HttpOnly cookies. Rotation on login defeats fixation (a fresh token is
// always minted; any presented token is ignored for the new session).
import { hmacSign, randomToken, sha256Hex } from "./crypto";
import type { Store } from "./store";
import type { Env, UserRow } from "./types";

export const SESSION_COOKIE = "infaix_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionContext {
  store: Store;
  env: Env;
  now: () => number;
  ip: string | null;
  userAgent: string | null;
  secure: boolean;
}

function sessionSecret(env: Env): string | null {
  return env.SESSION_SECRET && env.SESSION_SECRET.length >= 32 ? env.SESSION_SECRET : null;
}

/** Signed cookie value: <token>.<hmac(token)> — tampering is detectable. */
export async function signToken(env: Env, token: string): Promise<string | null> {
  const secret = sessionSecret(env);
  if (!secret) return null;
  return `${token}.${await hmacSign(secret, token)}`;
}

export async function unsignToken(env: Env, signed: string): Promise<string | null> {
  const secret = sessionSecret(env);
  if (!secret) return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const token = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  if (!/^[0-9a-f]{64}$/.test(sig)) return null;
  const expected = await hmacSign(secret, token);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? token : null;
}

export function parseSessionCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export function buildSetCookie(signed: string, secure: boolean, maxAgeSec: number): string {
  let c = `${SESSION_COOKIE}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
  if (secure) c += "; Secure";
  return c;
}

export function buildClearCookie(secure: boolean): string {
  let c = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (secure) c += "; Secure";
  return c;
}

export interface SessionResult {
  setCookie: string;
  sessionId: string;
  expiresAt: number;
}

/** Mint a brand-new session (always fresh — call on every login). */
export async function createSession(ctx: SessionContext, userId: string): Promise<SessionResult | null> {
  const token = randomToken();
  const signature = await signToken(ctx.env, token);
  if (!signature) return null; // SESSION_SECRET missing/misconfigured
  const now = ctx.now();
  const sessionId = await sha256Hex(token);
  const expiresAt = now + SESSION_TTL_MS;
  await ctx.store.insertSession({
    id: sessionId,
    user_id: userId,
    created_at: now,
    expires_at: expiresAt,
    last_seen_at: now,
    ip: ctx.ip,
    user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 200) : null,
  });
  return {
    setCookie: buildSetCookie(signature, ctx.secure, Math.floor(SESSION_TTL_MS / 1000)),
    sessionId,
    expiresAt,
  };
}

export interface AuthenticatedSession {
  user: UserRow;
  sessionId: string;
}

/**
 * Validate the session cookie: signature, expiry, and — critically — the
 * account must still be ACTIVE. Disabled accounts lose access immediately,
 * even with a previously valid session. Sliding expiry refreshes the TTL.
 */
export async function verifySession(
  ctx: SessionContext,
  cookieHeader: string | null
): Promise<AuthenticatedSession | null> {
  const presented = parseSessionCookie(cookieHeader);
  if (!presented) return null;
  const token = await unsignToken(ctx.env, presented);
  if (!token) return null;
  const sessionId = await sha256Hex(token);
  const session = await ctx.store.getSession(sessionId);
  if (!session) return null;
  const now = ctx.now();
  if (session.expires_at <= now) {
    await ctx.store.deleteSession(sessionId);
    return null;
  }
  const user = await ctx.store.getUserById(session.user_id);
  if (!user || user.status !== "ACTIVE") return null;
  await ctx.store.touchSession(sessionId, now + SESSION_TTL_MS, now);
  return { user, sessionId };
}
