import { describe, expect, it } from "vitest";
import { validateCoreContinuation, validateProductCallback } from "../worker/auth/continuation";
import { makeWorld } from "./helpers";

const env = { ...makeWorld().ctx.env, CHAT_ORIGIN: "https://chat.infaix.com", CHAT_EXTRA_ORIGINS: "https://infaix-chat-dev.infaix.workers.dev", STUDY_ORIGIN: "https://study.infaix.com", STUDY_EXTRA_ORIGINS: "https://study-dev.infaix.workers.dev" };
const callback = "https://chat.infaix.com/api/auth/core/callback";
describe("server continuation boundary", () => {
  it("rejects literal and encoded C1 control characters", () => {
    for (const value of ["/a\u0085", "/a%C2%85", "/account?q=%C2%9F"]) {
      expect(validateCoreContinuation(value, env)).toEqual({ kind: "fallback", destination: "/account" });
    }
  });
  it.each(["/account", "/ai", "/account?tab=profile", "/" + "a".repeat(2047)])("preserves %s", (value) => {
    expect(validateCoreContinuation(value, env)).toEqual({ kind: "valid", destination: value });
  });
  it.each([null, "https://evil.example", "//evil.example", "/\\evil.example", "/a\n", "/%zz", "/%2e%2e/a", "/%252e%252e/a", "/%252f%252fevil.example", "/a/../b", "/" + "a".repeat(2048), "/account?returnTo=/a&returnTo=/b"])("falls back for ordinary invalid %s", (value) => {
    expect(validateCoreContinuation(value, env)).toEqual({ kind: "fallback", destination: "/account" });
  });
  it.each([['chat', callback], ['chat', 'https://infaix-chat-dev.infaix.workers.dev/api/auth/core/callback'], ['study', 'https://study.infaix.com/api/auth/core/callback'], ['study', 'https://study-dev.infaix.workers.dev/api/auth/core/callback']])("validates nested %s callback independently", (product, target) => {
    const value = `/api/auth/${product}?return_to=${encodeURIComponent(target + '?next=%2Fmessages%3Fid%3Dabc')}`;
    expect(validateCoreContinuation(value, env)).toEqual({ kind: "valid", destination: value });
  });
  it.each(["https://evil.example/api/auth/core/callback", "https://user@chat.infaix.com/api/auth/core/callback", callback + "#fragment", callback + "?unexpected=1", callback + "?next=/home&next=/messages", callback + "?next=%2F%252e%252e%2Fhome", callback + "?next=%2F%2Fevil.example", "https://chat.infaix.com/other", "https://chat.infaix.com/api/auth/core/%63allback"])("rejects an explicit malformed product callback %s", (target) => {
    expect(validateCoreContinuation(`/api/auth/chat?return_to=${encodeURIComponent(target)}`, env)).toEqual({ kind: "rejected", code: "INVALID_REDIRECT" });
  });
  it("rejects duplicate outer callback and unexpected product-route parameters", () => {
    for (const value of [`/api/auth/chat?return_to=${encodeURIComponent(callback)}&return_to=${encodeURIComponent(callback)}`, "/api/auth/chat?next=/home", "/api/auth/unknown?return_to=x", "/api/auth/chat#x"]) {
      expect(validateCoreContinuation(value, env).kind).toBe("rejected");
    }
  });
  it("uses configured exact callback authority without URL normalization bypasses", () => {
    for (const target of ["https://CHAT.infaix.com/api/auth/core/callback", "https://chat.infaix.com:443/api/auth/core/callback", "https://chat.infaix.com/a/../api/auth/core/callback", "https://chat.infaix.com/api/auth/core/callback?next=%ZZ"]) {
      expect(validateProductCallback(target, ["https://chat.infaix.com"], "/api/auth/core/callback")).toBeNull();
    }
  });
});
