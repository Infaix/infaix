import { describe, expect, it } from "vitest";
import { authSecurityConfig } from "../worker/auth/security-config";

describe("fail-closed auth configuration", () => {
  it.each([['true', true], ['false', false], [undefined, false], ['TRUE', false], ['1', false], [' true ', false], ['', false]])("signup %s -> %s", (value, expected) => {
    expect(authSecurityConfig({ PUBLIC_SIGNUP_ENABLED: value }).publicSignupEnabled).toBe(expected);
  });
  it("has no production bypass or credential defaults", () => {
    const config = authSecurityConfig({ ENVIRONMENT: "production" });
    expect(config.publicSignupEnabled).toBe(false);
    expect(config.turnstileSecret).toBeNull();
    expect(config.abuseHmacSecret).toBeNull();
    expect(config.turnstileHostnames).toEqual([]);
  });
  it("reads explicit server settings and rejects malformed hostname lists", () => {
    expect(authSecurityConfig({ TURNSTILE_ALLOWED_HOSTNAMES: "infaix.com,core-dev.infaix.workers.dev" }).turnstileHostnames).toEqual(["infaix.com", "core-dev.infaix.workers.dev"]);
    for (const value of ["https://infaix.com", "infaix.com,*.evil.example", "infaix.com,", "infaix.com/path"]) {
      expect(authSecurityConfig({ TURNSTILE_ALLOWED_HOSTNAMES: value }).turnstileHostnames).toEqual([]);
    }
  });
});
