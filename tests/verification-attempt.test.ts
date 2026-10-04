import { describe, expect, it } from "vitest";
import { verificationAttempt } from "../src/lib/verification-attempt";

describe("verification link visit", () => {
  it("starts one request for a token and ignores a repeat of that token", () => {
    const token = "a".repeat(43);
    const first = verificationAttempt(token, null);
    expect(first).toBe(token);
    expect(verificationAttempt(token, first)).toBeNull();
  });

  it("still allows one attempt at a different or reused link", () => {
    const used = "b".repeat(43);
    expect(verificationAttempt(used, "a".repeat(43))).toBe(used);
    expect(verificationAttempt(null, used)).toBeNull();
  });
});
