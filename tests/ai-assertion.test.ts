import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  ASSERTION_AUDIENCE,
  ASSERTION_ISSUER,
  ASSERTION_TTL_SEC,
  mintAiAssertion,
  requestBinding,
  verifyAiAssertion,
} from "../worker/auth/assertion";

const SECRET = new TextEncoder().encode("ai-gateway-shared-secret-min-32!!");
const OTHER = new TextEncoder().encode("completely-different-secret-00000!!");
const NOW = Math.floor(1_750_000_000_000 / 1000);

async function mint(over: Partial<Parameters<typeof mintAiAssertion>[0]> = {}) {
  return mintAiAssertion({
    secret: SECRET,
    userId: "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
    role: "USER",
    aiAccess: true,
    reqBinding: "reqhash",
    nowSec: NOW,
    ...over,
  });
}

function secrets(current: Uint8Array | null = SECRET, previous: Uint8Array | null = null) {
  return { current, previous };
}

describe("AI gateway assertions (jose HS256)", () => {
  it("round-trips a valid assertion with all claims", async () => {
    const token = await mint();
    const res = await verifyAiAssertion({ token, secrets: secrets(), expectedReqBinding: "reqhash", nowSec: NOW + 10 });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("should verify");
    expect(res.claims.sub).toBe("usr_aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(res.claims.role).toBe("USER");
    expect(res.claims.ai_access).toBe(true);
    expect(res.claims.req).toBe("reqhash");
    expect(res.claims.jti).toMatch(/^jti_[0-9a-f]{24}$/);
  });

  it("has ~90s lifetime", async () => {
    const token = await mint();
    const parts = token.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    expect(payload.exp - payload.iat).toBe(ASSERTION_TTL_SEC);
    expect(ASSERTION_TTL_SEC).toBe(90);
  });

  it("rejects invalid signatures", async () => {
    const token = await mint();
    const res = await verifyAiAssertion({ token, secrets: secrets(OTHER), nowSec: NOW + 10 });
    expect(res).toEqual({ ok: false, error: "INVALID_SIGNATURE" });
  });

  it("rejects expired assertions", async () => {
    const token = await mint();
    const res = await verifyAiAssertion({ token, secrets: secrets(), nowSec: NOW + ASSERTION_TTL_SEC + 60 });
    expect(res).toEqual({ ok: false, error: "EXPIRED" });
  });

  it("rejects wrong audience", async () => {
    const token = await mint({ audience: "evil.example" });
    const res = await verifyAiAssertion({ token, secrets: secrets(), nowSec: NOW + 10 });
    expect(res).toEqual({ ok: false, error: "WRONG_AUDIENCE" });
  });

  it("rejects wrong issuer", async () => {
    const token = await new SignJWT({ sub: "u", role: "USER", ai_access: true, req: "r", jti: "jti_aaaaaaaaaaaaaaaaaaaaaaaa" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("mallory")
      .setAudience(ASSERTION_AUDIENCE)
      .setIssuedAt(NOW)
      .setExpirationTime(NOW + 90)
      .sign(SECRET);
    const res = await verifyAiAssertion({ token, secrets: secrets(), nowSec: NOW + 10 });
    expect(res).toEqual({ ok: false, error: "WRONG_ISSUER" });
  });

  it("rejects missing claims", async () => {
    const token = await new SignJWT({ sub: "u" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ASSERTION_ISSUER)
      .setAudience(ASSERTION_AUDIENCE)
      .setIssuedAt(NOW)
      .setExpirationTime(NOW + 90)
      .sign(SECRET);
    const res = await verifyAiAssertion({ token, secrets: secrets(), nowSec: NOW + 10 });
    expect(res).toEqual({ ok: false, error: "MISSING_CLAIMS" });
  });

  it("rejects request binding mismatch", async () => {
    const token = await mint();
    const res = await verifyAiAssertion({ token, secrets: secrets(), expectedReqBinding: "other", nowSec: NOW + 10 });
    expect(res).toEqual({ ok: false, error: "BINDING_MISMATCH" });
  });

  it("accepts the previous secret during rotation", async () => {
    const token = await mintAiAssertion({
      secret: OTHER,
      userId: "u",
      role: "ADMIN",
      aiAccess: true,
      reqBinding: "r",
      nowSec: NOW,
    });
    const res = await verifyAiAssertion({ token, secrets: secrets(SECRET, OTHER), nowSec: NOW + 10 });
    expect(res.ok).toBe(true);
  });

  it("generates unique jtis", async () => {
    const a = await mint();
    const b = await mint();
    const jti = (t: string): string =>
      JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString("utf8")).jti as string;
    expect(jti(a)).not.toBe(jti(b));
  });

  it("request binding is canonical and body-sensitive", async () => {
    const enc = new TextEncoder();
    const a = await requestBinding("POST", "/chat", enc.encode('{"a":1}'));
    expect(await requestBinding("POST", "/chat", enc.encode('{"a":1}'))).toBe(a);
    expect(await requestBinding("POST", "/chat", enc.encode('{"a":2}'))).not.toBe(a);
    expect(await requestBinding("GET", "/chat", enc.encode('{"a":1}'))).not.toBe(a);
    expect(await requestBinding("POST", "/other", enc.encode('{"a":1}'))).not.toBe(a);
  });
});
