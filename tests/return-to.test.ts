import { describe, expect, it } from "vitest";
import { safeReturnTo } from "../src/lib/return-to";

describe("safeReturnTo (login redirect guard)", () => {
  it("accepts plain internal paths", () => {
    expect(safeReturnTo("/account")).toBe("/account");
    expect(safeReturnTo("/ai")).toBe("/ai");
    expect(safeReturnTo("/account/admin/ai-access")).toBe("/account/admin/ai-access");
    expect(safeReturnTo("/verify-email?token=abc")).toBe("/verify-email?token=abc");
    expect(safeReturnTo("/login#top")).toBe("/login#top");
  });

  it("falls back for missing values", () => {
    expect(safeReturnTo(null)).toBe("/account");
    expect(safeReturnTo(undefined)).toBe("/account");
    expect(safeReturnTo("")).toBe("/account");
    expect(safeReturnTo("   ")).toBe("/account");
  });

  it("rejects absolute and protocol-relative URLs (no open redirect)", () => {
    for (const evil of [
      "https://evil.example",
      "http://evil.example/phish",
      "//evil.example",
      "///evil.example",
      "javascript:alert(1)",
      "data:text/html,hi",
    ]) {
      expect(safeReturnTo(evil)).toBe("/account");
    }
  });

  it("rejects relative paths, backslashes, and schemes in path", () => {
    expect(safeReturnTo("account")).toBe("/account");
    expect(safeReturnTo("/a\\b")).toBe("/account");
    expect(safeReturnTo("/\\evil")).toBe("/account");
    expect(safeReturnTo("/foo:bar")).toBe("/account");
  });

  it("rejects traversal and encoded tricks", () => {
    expect(safeReturnTo("/../admin")).toBe("/account");
    expect(safeReturnTo("/a/./b")).toBe("/account");
    expect(safeReturnTo("/%2Fevil")).toBe("/account");
    expect(safeReturnTo("/%2f%2fevil.example")).toBe("/account");
    expect(safeReturnTo("/a%5c..%5cetc")).toBe("/account");
    expect(safeReturnTo("/%2e%2e/admin")).toBe("/account");
    expect(safeReturnTo("/%zz")).toBe("/account");
  });

  it("rejects whitespace, angle brackets, quotes, and overlong values", () => {
    expect(safeReturnTo("/a b")).toBe("/account");
    expect(safeReturnTo("/a<b")).toBe("/account");
    expect(safeReturnTo('/a"b')).toBe("/account");
    expect(safeReturnTo("/" + "a".repeat(600))).toBe("/account");
  });

  it("honors a custom fallback", () => {
    expect(safeReturnTo("https://evil.example", "/ai")).toBe("/ai");
    expect(safeReturnTo(null, "/ai")).toBe("/ai");
  });
});
