// Cryptography for the account system. Uses only the Web Crypto API
// (available in Cloudflare Workers and Node 20+), so there are no new
// password-hashing dependencies to audit. Passwords are hashed with
// PBKDF2-SHA256; all single-use tokens are random and stored as SHA-256.

const te = new TextEncoder();

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(s: string): Uint8Array {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm + "=".repeat((4 - (norm.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 32 cryptographically random bytes, base64url-encoded (43 chars). */
export function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToBase64Url(b);
}

/** Short prefixed IDs, e.g. usr_9f3a... (12 random bytes, 24 hex chars). */
export function newId(prefix: string): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return `${prefix}_${bytesToHex(b)}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", te.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export async function sha256HexBytes(input: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", input as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

export const DEFAULT_PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function parseIterations(raw: string | undefined): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isSafeInteger(n) || n < 50_000 || n > 2_000_000) return DEFAULT_PBKDF2_ITERATIONS;
  return n;
}

/**
 * Hash a password. Format: pbkdf2-sha256$<iterations>$<salt-b64>$<key-b64>.
 * Iteration count is configurable so deployments can tune CPU cost.
 */
export async function hashPassword(password: string, iterationsRaw?: string): Promise<string> {
  const iterations = parseIterations(iterationsRaw);
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]),
    KEY_BYTES * 8
  );
  return `pbkdf2-sha256$${iterations}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(key))}`;
}

/** Constant-format comparison of a password against a stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isSafeInteger(iterations) || iterations < 1) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = base64UrlToBytes(parts[2]);
    expected = base64UrlToBytes(parts[3]);
  } catch {
    return false;
  }
  const key = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]),
    expected.length * 8
  );
  const actual = new Uint8Array(key);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** HMAC-SHA256 signature (hex) used for tamper-evident session cookies. */
export async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(data));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Timing-safe HMAC verification via WebCrypto (constant-time compare in
 * the platform implementation — never plain string equality).
 */
export async function hmacVerify(secret: string, data: string, sigHex: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(sigHex)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sig = new Uint8Array(sigHex.length / 2);
  for (let i = 0; i < sig.length; i++) sig[i] = parseInt(sigHex.slice(i * 2, i * 2 + 2), 16);
  try {
    return await crypto.subtle.verify("HMAC", key, sig as BufferSource, te.encode(data));
  } catch {
    return false;
  }
}
