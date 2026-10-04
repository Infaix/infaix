import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { abuseDigest, networkSignal } from "../worker/auth/abuse";

const env = { AUTH_ABUSE_HASH_SECRET: "unit-test-only-high-entropy-material-00000000" };
describe("purpose-separated keyed abuse signals", () => {
  it("uses HMAC-SHA256 and canonical email rather than plain email hashing", async () => {
    const digest = await abuseDigest(env, "login-email", " Ada@Infaix.com ");
    expect(digest).toBe(createHmac("sha256", env.AUTH_ABUSE_HASH_SECRET).update("login-email\0ada@infaix.com").digest("hex"));
    expect(await abuseDigest(env, "login-email", "ada@infaix.com")).toBe(digest);
    expect(digest).not.toContain("ada");
  });
  it("separates purposes, signals and keys", async () => {
    const digest = await abuseDigest(env, "login-email", "a@infaix.com");
    expect(await abuseDigest(env, "registration-email", "a@infaix.com")).not.toBe(digest);
    expect(await abuseDigest(env, "login-email", "b@infaix.com")).not.toBe(digest);
    expect(await abuseDigest({ AUTH_ABUSE_HASH_SECRET: "different-test-secret-material-00000000" }, "login-email", "a@infaix.com")).not.toBe(digest);
  });
  it.each([undefined, "", "short", " secret-with-leading-space-but-long-enough", "a".repeat(4097)])("fails closed for malformed secret %s", async (secret) => {
    await expect(abuseDigest({ AUTH_ABUSE_HASH_SECRET: secret }, "login-email", "private@infaix.com")).rejects.toMatchObject({ code: "AUTH_SECURITY_UNAVAILABLE" });
  });
  it("never falls back to an old-named secret or echoes invalid input", async () => {
    await expect(abuseDigest({ AUTH_ABUSE_HMAC_SECRET: env.AUTH_ABUSE_HASH_SECRET }, "login-email", "a@infaix.com")).rejects.toMatchObject({ code: "AUTH_SECURITY_UNAVAILABLE" });
    const error = await abuseDigest(env, "login-email", "private-invalid-value").catch((e: unknown) => e);
    expect(String(error)).not.toContain("private-invalid-value");
  });
});

describe("trusted network abuse signal", () => {
  it("ignores forged forwarding headers without Cloudflare metadata", () => {
    const req = new Request("https://infaix.com", { headers: {
      "cf-connecting-ip": "198.51.100.1", "x-forwarded-for": "198.51.100.2", "x-real-ip": "198.51.100.3",
    } });
    expect(networkSignal(req)).toBe("shared-untrusted");
    expect(networkSignal(new Request("https://infaix.com"))).toBe("shared-untrusted");
  });
  it("reads Cloudflare-owned connecting IP, not forwarding headers", () => {
    const req = new Request("https://infaix.com", { headers: { "cf-connecting-ip": "198.51.100.1", "x-forwarded-for": "198.51.100.2" } });
    Object.defineProperty(req, "cf", { value: { colo: "SYD" } });
    expect(networkSignal(req)).toBe("198.51.100.1");
  });
  it("canonicalizes IPv6 and supports explicit local injected signals", () => {
    const req = new Request("http://localhost");
    expect(networkSignal(req, "2001:0db8:0:0:0:0:0:1")).toBe("2001:db8::1");
    expect(networkSignal(req, "198.51.100.1")).toBe("198.51.100.1");
  });
  it.each(["999.1.1.1", "198.51.100.1,198.51.100.2", "arbitrary-value", "", "010.0.0.1"])("uses shared fallback for invalid signal %s", (value) => {
    expect(networkSignal(new Request("http://localhost"), value)).toBe("shared-untrusted");
  });
});
