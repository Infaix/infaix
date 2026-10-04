/** Worker-only configuration. Never import this module into browser code. */
export interface AuthSecurityEnv {
  ENVIRONMENT?: string;
  PUBLIC_SIGNUP_ENABLED?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_ALLOWED_HOSTNAMES?: string;
  AUTH_ABUSE_HMAC_SECRET?: string;
}

export interface AuthSecurityConfig {
  publicSignupEnabled: boolean;
  turnstileSecret: string | null;
  turnstileHostnames: readonly string[];
  abuseHmacSecret: string | null;
}

export function authSecurityConfig(env: AuthSecurityEnv): AuthSecurityConfig {
  const hostnames = env.TURNSTILE_ALLOWED_HOSTNAMES?.split(",") ?? [];
  const validHosts = hostnames.every((host) => host.length <= 253 && host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)));
  const secret = (value: string | undefined) => value && value.trim() === value ? value : null;
  return {
    publicSignupEnabled: env.PUBLIC_SIGNUP_ENABLED === "true",
    turnstileSecret: secret(env.TURNSTILE_SECRET_KEY),
    turnstileHostnames: validHosts ? [...new Set(hostnames)] : [],
    abuseHmacSecret: secret(env.AUTH_ABUSE_HMAC_SECRET),
  };
}

export type SignupDecision =
  | { ok: true }
  | {
      ok: false;
      status: 403 | 503;
      code: "SIGNUP_DISABLED" | "ABUSE_CONTROL_UNAVAILABLE";
      message: string;
    };

/**
 * Server-side public registration gate. Consulted by the registration
 * handler on every request; no client-supplied field can influence it.
 *
 * Development and test environments stay open so local work and the test
 * suite are unaffected. In production PUBLIC_SIGNUP_ENABLED must be exactly
 * the string "true"; a missing, misspelled or falsy value closes signup
 * rather than defaulting to open. The shipped wrangler.jsonc does not set it,
 * so production signup is closed until a deliberate rollout sets it.
 *
 * This gate is the KILL SWITCH only. It is not bot protection: the Worker
 * still has no Turnstile verification path, so opening this switch does not
 * make public signup safe to expose to the internet. That gap is recorded as
 * a launch prerequisite in SECURITY.md rather than papered over here.
 */
export function publicSignupDecision(env: AuthSecurityEnv): SignupDecision {
  const config = authSecurityConfig(env);
  if (env.ENVIRONMENT !== "production") return { ok: true };
  if (!config.publicSignupEnabled) {
    return {
      ok: false,
      status: 403,
      code: "SIGNUP_DISABLED",
      message: "Public registration is not currently open.",
    };
  }
  return { ok: true };
}
