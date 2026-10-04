import { authSecurityConfig, type AuthSecurityEnv } from "./security-config";
import { normalizeEmail } from "./validation";

export type AbuseDigest = string & { readonly __abuseDigest: unique symbol };
const PURPOSES = [
  "registration-network", "registration-email", "login-network", "login-email",
  "recovery-network", "verification-network", "verification-redemption-network",
  "reset-confirmation-network", "handoff-network", "handoff-account", "email-send",
] as const;
export type AbusePurpose = typeof PURPOSES[number];
export interface AbuseEnv extends AuthSecurityEnv { AUTH_ABUSE_HASH_SECRET?: string }

export class AuthSecurityUnavailable extends Error {
  readonly code = "AUTH_SECURITY_UNAVAILABLE";
  constructor() { super("Authentication security is temporarily unavailable."); this.name = "AuthSecurityUnavailable"; }
}

/** Worker-only; callers must never log the signal, key or resulting digest. */
export async function abuseDigest(env: AbuseEnv, purpose: AbusePurpose, signal: string): Promise<AbuseDigest> {
  // Reuse Phase1 validation without changing its existing configuration contract.
  const secret = authSecurityConfig({ AUTH_ABUSE_HMAC_SECRET: env.AUTH_ABUSE_HASH_SECRET }).abuseHmacSecret;
  const encoder = new TextEncoder();
  if (!secret || encoder.encode(secret).byteLength < 32 || encoder.encode(secret).byteLength > 4096 ||
      !PURPOSES.includes(purpose) || typeof signal !== "string" || !signal || signal.length > 512 || signal.includes("\0")) {
    throw new AuthSecurityUnavailable();
  }
  const value = purpose.endsWith("-email") || purpose === "email-send" ? normalizeEmail(signal) : signal;
  if (!value) throw new AuthSecurityUnavailable();
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${purpose}\0${value}`)));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") as AbuseDigest;
  } catch { throw new AuthSecurityUnavailable(); }
}

function canonicalIP(value: string | null | undefined): string | null {
  if (!value || value.length > 45) return null;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    const parts = value.split(".");
    return parts.every((part) => Number(part) <= 255 && String(Number(part)) === part) ? value : null;
  }
  if (!/^[0-9a-f:.]+$/i.test(value) || !value.includes(":")) return null;
  try { return new URL(`http://[${value}]/`).hostname.slice(1, -1); } catch { return null; }
}

/** `cf` is edge-owned metadata, never an HTTP header. Injection is for trusted local callers only. */
export function networkSignal(req: Request, injectedSignal?: string): string {
  if (injectedSignal !== undefined) return canonicalIP(injectedSignal) ?? "shared-untrusted";
  const cf: unknown = (req as Request & { cf?: unknown }).cf;
  if (!cf || typeof cf !== "object") return "shared-untrusted";
  return canonicalIP(req.headers.get("cf-connecting-ip")) ?? "shared-untrusted";
}
