import { describe, expect, it } from "vitest";
import { checkDisplayName, checkPassword, checkToken, normalizeEmail } from "../worker/auth/validation";

describe("email validation", () => {
  it("accepts normal addresses and normalizes case/whitespace", () => {
    expect(normalizeEmail("  Ada@INFAIX.com ")).toBe("ada@infaix.com");
  });
  it("rejects malformed addresses", () => {
    for (const bad of ["", "a", "no-at-sign", "a@b", "a@b..com", "x@y.", "@x.com", 42, null, "a".repeat(250) + "@x.com"]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });
});

describe("password policy", () => {
  it("accepts a strong password", () => {
    expect(checkPassword("Correct-Horse-99-Battery").ok).toBe(true);
  });
  it("rejects short, long, weak, and non-string passwords", () => {
    expect(checkPassword("Short1!").ok).toBe(false);
    expect(checkPassword("a".repeat(129)).ok).toBe(false);
    expect(checkPassword("alllowercasepassword").ok).toBe(false);
    expect(checkPassword("ALLUPPERCASEPASS").ok).toBe(false);
    expect(checkPassword("123456789012").ok).toBe(false);
    expect(checkPassword(null).ok).toBe(false);
  });
  it("requires 3 of 4 character classes", () => {
    expect(checkPassword("lowercase12AB").ok).toBe(true); // lower+digit+upper
    expect(checkPassword("lowercase!!!!").ok).toBe(false); // lower+symbol only
  });
});

describe("display names and tokens", () => {
  it("trims and bounds display names", () => {
    expect(checkDisplayName("  Ada  Lovelace  ")).toBe("Ada Lovelace");
    expect(checkDisplayName("")).toBeNull();
    expect(checkDisplayName("x".repeat(61))).toBeNull();
    expect(checkDisplayName("bad\x01name")).toBeNull();
  });
  it("only accepts 43-char base64url tokens", () => {
    expect(checkToken("A".repeat(43))).toBe("A".repeat(43));
    expect(checkToken("short")).toBeNull();
    expect(checkToken("A".repeat(42) + "!")).toBeNull();
    expect(checkToken(123)).toBeNull();
  });
});
