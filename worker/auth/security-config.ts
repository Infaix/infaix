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
