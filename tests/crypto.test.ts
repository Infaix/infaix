import { describe, expect, it } from "vitest";
import { hashPassword, hmacSign, newId, randomToken, sha256Hex, verifyPassword } from "../worker/auth/crypto";

describe("password hashing (PBKDF2-SHA256)", () => {
  it("verifies correct passwords and rejects wrong ones", async () => {
    const hash = await hashPassword("Correct-Horse-99-Battery", "50000");
    expect(hash.startsWith("pbkdf2-sha256$50000$")).toBe(true);
    expect(await verifyPassword("Correct-Horse-99-Battery", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-123!", hash)).toBe(false);
  });
  it("uses unique salts (same password, different hashes)", async () => {
    const a = await hashPassword("Correct-Horse-99-Battery", "50000");
    const b = await hashPassword("Correct-Horse-99-Battery", "50000");
    expect(a).not.toBe(b);
  });
  it("rejects malformed stored hashes without throwing", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2-sha256$abc$def$ghi")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("tokens and ids", () => {
  it("generates unique 43-char tokens", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toHaveLength(43);
    expect(a).not.toBe(b);
    expect(/^[A-Za-z0-9_-]{43}$/.test(a)).toBe(true);
  });
  it("generates prefixed ids", () => {
    expect(newId("usr")).toMatch(/^usr_[0-9a-f]{24}$/);
  });
  it("sha256 is deterministic hex", async () => {
    const h = await sha256Hex("hello");
    expect(h).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
  it("hmac signs deterministically", async () => {
    const a = await hmacSign("secret", "data");
    expect(a).toHaveLength(64);
    expect(await hmacSign("secret", "data")).toBe(a);
    expect(await hmacSign("other", "data")).not.toBe(a);
  });
});
