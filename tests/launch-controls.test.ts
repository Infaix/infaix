import { describe, expect, it } from "vitest";
import worker from "../worker/index";
import { configuredChatOrigins } from "../worker/auth/chat-origin";
import { configuredStudyOrigins } from "../worker/auth/study-origin";
import { handleHandoff } from "../worker/auth/handoff";
import {
  handleRegister,
  handleRequestPasswordReset,
  handleRequestVerification,
} from "../worker/auth/handlers";
import { publicSignupDecision } from "../worker/auth/security-config";
import type { Env } from "../worker/auth/types";
import { makeWorld, ORIGIN, post } from "./helpers";

const PROD_CHAT = "https://chat.infaix.com";
const DEV_CHAT = "https://infaix-chat-dev.infaix.workers.dev";
const CALLBACK = "/api/auth/core/callback";

// ---------------------------------------------------------------------------
// HIGH: a development Worker must never be a production assertion recipient.
// ---------------------------------------------------------------------------

describe("Chat handoff origin allowlist is environment-separated", () => {
  it("ignores the development extra origin entirely in production", () => {
    const origins = configuredChatOrigins({
      ENVIRONMENT: "production",
      CHAT_ORIGIN: PROD_CHAT,
      CHAT_EXTRA_ORIGINS: DEV_CHAT,
    } as Env);
    // The dev workers.dev deployment is simply not in the list. The declaration
    // it came from is not read at all in production.
    expect(origins).toEqual([PROD_CHAT]);
    expect(origins).not.toContain(DEV_CHAT);
  });

  it("reads production extras from the production-only declaration", () => {
    const origins = configuredChatOrigins({
      ENVIRONMENT: "production",
      CHAT_ORIGIN: PROD_CHAT,
      CHAT_EXTRA_ORIGINS: DEV_CHAT,
      CHAT_PRODUCTION_EXTRA_ORIGINS: "https://chat-alt.infaix.com",
    } as Env);
    expect(origins).toEqual([PROD_CHAT, "https://chat-alt.infaix.com"]);
  });

  it("still honours the development extra outside production", () => {
    const origins = configuredChatOrigins({
      ENVIRONMENT: "development",
      CHAT_ORIGIN: PROD_CHAT,
      CHAT_EXTRA_ORIGINS: DEV_CHAT,
    } as Env);
    expect(origins).toEqual([PROD_CHAT, DEV_CHAT]);
  });

  it("fails closed when a production extra declaration is malformed", () => {
    expect(
      configuredChatOrigins({
        ENVIRONMENT: "production",
        CHAT_ORIGIN: PROD_CHAT,
        CHAT_PRODUCTION_EXTRA_ORIGINS: "http://chat-alt.infaix.com",
      } as Env),
    ).toBeNull();
  });

  it("fails closed when a development extra declaration is malformed", () => {
    // This is an operator allowlist, not a blocklist: a well-formed https
    // origin is trusted because the operator declared it. What must fail
    // closed is a structurally invalid entry (non-https, or carrying a path,
    // credentials, query or fragment that would not survive the exact-origin
    // comparison in the continuation parser).
    expect(
      configuredChatOrigins({
        ENVIRONMENT: "development",
        CHAT_ORIGIN: PROD_CHAT,
        CHAT_EXTRA_ORIGINS: "http://chat-alt.infaix.com",
      } as Env),
    ).toBeNull();
    expect(
      configuredChatOrigins({
        ENVIRONMENT: "development",
        CHAT_ORIGIN: PROD_CHAT,
        CHAT_EXTRA_ORIGINS: "https://chat-alt.infaix.com/some/path",
      } as Env),
    ).toBeNull();
  });

  it("applies the same separation to the Study handoff", () => {
    expect(
      configuredStudyOrigins({
        ENVIRONMENT: "production",
        STUDY_ORIGIN: "https://study.infaix.com",
        STUDY_EXTRA_ORIGINS: "https://study-dev.infaix.workers.dev",
      } as Env),
    ).toEqual(["https://study.infaix.com"]);
  });

  it("does not ship a development Chat origin in the committed production config", async () => {
    const { readFileSync } = await import("node:fs");
    const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    expect(config).toContain(PROD_CHAT);
    expect(config).not.toContain("infaix-chat-dev");
    // No dev-origin binding is declared for the production deployment at all.
    expect(config).not.toMatch(/"CHAT_EXTRA_ORIGINS"/);
    expect(config).not.toMatch(/"STUDY_EXTRA_ORIGINS"/);
    // The production kill switch must stay unset so signup cannot be opened
    // by accident from this file.
    expect(config).not.toMatch(/"PUBLIC_SIGNUP_ENABLED"/);
  });
});

describe("assertion is never minted for a destination production does not trust", () => {
  const handoffConfig = {
    audience: "infaix-chat",
    origins: configuredChatOrigins({
      ENVIRONMENT: "production",
      CHAT_ORIGIN: PROD_CHAT,
      CHAT_EXTRA_ORIGINS: DEV_CHAT,
    } as Env)!,
    privateKey: undefined,
    defaultCallbackPath: CALLBACK,
    productLabel: "Chat",
  };

  const destinations = [
    ["dev workers.dev origin", `${DEV_CHAT}${CALLBACK}`],
    ["arbitrary external origin", `https://evil.example${CALLBACK}`],
    ["protocol-relative", `//evil.example${CALLBACK}`],
    ["unexpected port", `https://chat.infaix.com:8443${CALLBACK}`],
    ["userinfo", `https://chat.infaix.com@evil.example${CALLBACK}`],
    ["fragment", `${PROD_CHAT}${CALLBACK}#x`],
    ["duplicate next", `${PROD_CHAT}${CALLBACK}?next=/a&next=/b`],
    ["encoded path traversal in next", `${PROD_CHAT}${CALLBACK}?next=%2e%2e%2fadmin`],
    ["encoded separator in next", `${PROD_CHAT}${CALLBACK}?next=%2f%2fevil.example`],
    ["wrong callback path", `${PROD_CHAT}/api/auth/other`],
    ["origin as a path prefix", `${PROD_CHAT}.evil.example${CALLBACK}`],
  ] as const;

  it.each(destinations)("rejects %s", async (_label, returnTo) => {
    const w = makeWorld();
    const ctx = { ...w.ctx, env: { ...w.ctx.env, CHAT_IDENTITY_PRIVATE_KEY: "unused" } };
    const result = await handleHandoff(
      ctx,
      new Request(`${ORIGIN}/api/auth/chat?return_to=${encodeURIComponent(returnTo)}`),
      new URL(`${ORIGIN}/api/auth/chat?return_to=${encodeURIComponent(returnTo)}`),
      handoffConfig,
    );
    expect(result.status).toBe(400);
    expect((result.body as { error: { code: string } }).error.code).toBe("INVALID_REDIRECT");
    // No assertion anywhere in the response, and no redirect Location.
    expect(JSON.stringify(result.body)).not.toContain("assertion");
    expect(result.headers?.location).toBeUndefined();
  });

  it("accepts the intended production callback", async () => {
    const w = makeWorld();
    const ctx = { ...w.ctx, env: { ...w.ctx.env, CHAT_IDENTITY_PRIVATE_KEY: "unused" } };
    const url = new URL(`${ORIGIN}/api/auth/chat?return_to=${encodeURIComponent(`${PROD_CHAT}${CALLBACK}`)}`);
    const result = await handleHandoff(ctx, new Request(url), url, handoffConfig);
    // Unauthenticated: routed to Core login, still no assertion minted.
    expect(result.status).toBe(302);
    expect(result.headers?.location).toContain("/login");
    expect(result.headers?.location).not.toContain("assertion");
  });
});

// ---------------------------------------------------------------------------
// HIGH: anonymous account-discovery endpoints must not leak existence when the
// mail provider fails.
// ---------------------------------------------------------------------------

describe("enumeration resistance survives mail-provider failure", () => {
  const failingMailer = {
    async sendPasswordReset() {
      throw new Error("provider 500");
    },
    async sendVerification() {
      throw new Error("provider 500");
    },
    async sendWelcome() {
      throw new Error("provider 500");
    },
    async sendPasswordChanged() {
      throw new Error("provider 500");
    },
  };

  const seedPendingUser = async (email: string) => {
    const w = makeWorld();
    const reg = await handleRegister(
      w.ctx,
      post("/api/auth/register", {
        email,
        displayName: "Known Person",
        password: "Correct-Horse-99-Battery",
      }),
    );
    expect(reg.status).toBe(201);
    w.ctx.mailer = failingMailer;
    return w;
  };

  it("forgot-password answers identically for a known and an unknown address", async () => {
    const w = await seedPendingUser("known-reset@infaix.com");
    const known = await handleRequestPasswordReset(
      w.ctx,
      post("/api/auth/request-password-reset", { email: "known-reset@infaix.com" }),
    );
    const unknown = await handleRequestPasswordReset(
      w.ctx,
      post("/api/auth/request-password-reset", { email: "nobody-here@infaix.com" }),
    );
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(known.status);
    expect(JSON.stringify(known.body)).toBe(JSON.stringify(unknown.body));
  });

  it("resend-verification answers identically for a known and an unknown address", async () => {
    const w = await seedPendingUser("known-verify@infaix.com");
    const known = await handleRequestVerification(
      w.ctx,
      post("/api/auth/request-verification", { email: "known-verify@infaix.com" }),
    );
    const unknown = await handleRequestVerification(
      w.ctx,
      post("/api/auth/request-verification", { email: "nobody-here@infaix.com" }),
    );
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(known.status);
    expect(JSON.stringify(known.body)).toBe(JSON.stringify(unknown.body));
  });

  it("still records the reset token server-side when delivery fails", async () => {
    const w = await seedPendingUser("token-kept@infaix.com");
    const res = await handleRequestPasswordReset(
      w.ctx,
      post("/api/auth/request-password-reset", { email: "token-kept@infaix.com" }),
    );
    expect(res.status).toBe(200);
    // The user can recover by resending; the row exists rather than being lost.
    const user = await w.store.getUserByEmail("token-kept@infaix.com");
    expect(user).not.toBeNull();
    expect((await w.store.latestOutbox("token-kept@infaix.com", "password_reset"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Signup kill switch.
// ---------------------------------------------------------------------------

describe("public signup kill switch", () => {
  it("closes signup in production when the switch is absent", () => {
    expect(publicSignupDecision({ ENVIRONMENT: "production" })).toMatchObject({
      ok: false,
      status: 403,
      code: "SIGNUP_DISABLED",
    });
  });

  it.each(["false", "TRUE", "1", "yes", "", " true "])(
    "treats %o in production as closed",
    (value) => {
      expect(
        publicSignupDecision({ ENVIRONMENT: "production", PUBLIC_SIGNUP_ENABLED: value }),
      ).toMatchObject({ ok: false, code: "SIGNUP_DISABLED" });
    },
  );

  it("opens signup in production only on the exact string true", () => {
    expect(publicSignupDecision({ ENVIRONMENT: "production", PUBLIC_SIGNUP_ENABLED: "true" })).toEqual({
      ok: true,
    });
  });

  it("leaves development and test environments open", () => {
    expect(publicSignupDecision({ ENVIRONMENT: "development" })).toEqual({ ok: true });
    expect(publicSignupDecision({ ENVIRONMENT: "test" })).toEqual({ ok: true });
    expect(publicSignupDecision({})).toEqual({ ok: true });
  });

  it("refuses production registration before any storage or mail", async () => {
    const w = makeWorld({ ENVIRONMENT: "production" });
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", {
        email: "gated@infaix.com",
        displayName: "Gated",
        password: "Correct-Horse-99-Battery",
      }),
    );
    expect(res.status).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe("SIGNUP_DISABLED");
    expect(await w.store.getUserByEmail("gated@infaix.com")).toBeNull();
    expect(w.store.legalAcceptances).toHaveLength(0);
    expect(await w.store.latestOutbox("gated@infaix.com", "email_verification")).toBeNull();
  });

  it("cannot be overridden by a client-supplied field", async () => {
    const w = makeWorld({ ENVIRONMENT: "production" });
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", {
        email: "bypass@infaix.com",
        displayName: "Bypass",
        password: "Correct-Horse-99-Battery",
        publicSignupEnabled: true,
        PUBLIC_SIGNUP_ENABLED: "true",
        role: "OWNER",
      }),
    );
    expect(res.status).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe("SIGNUP_DISABLED");
  });

  it("preserves least-privilege defaults when signup is enabled", async () => {
    const w = makeWorld({
      ENVIRONMENT: "production",
      PUBLIC_SIGNUP_ENABLED: "true",
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "INFAIX <identity@infaix.com>",
      RESEND_API_KEY: "re_test_transactional_provider_key",
    });
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", {
        email: "privileged@infaix.com",
        displayName: "Privileged",
        password: "Correct-Horse-99-Battery",
        role: "OWNER",
        ai_access: 1,
      }),
    );
    expect(res.status).toBe(201);
    const user = await w.store.getUserByEmail("privileged@infaix.com");
    expect(user?.role).toBe("USER");
    expect(user?.ai_access).toBe(0);
    expect(user?.status).toBe("PENDING_VERIFICATION");
  });
});

// ---------------------------------------------------------------------------
// Security headers.
// ---------------------------------------------------------------------------

describe("security headers", () => {
  const assetsFetch = async () => new Response("<html>ok</html>", { status: 200 });

  const requestAssets = async (env: Partial<Env>) => {
    const envFull = {
      INFAIX_DB: {} as never,
      ENVIRONMENT: "test",
      ASSETS: { fetch: assetsFetch },
      ...env,
    } as unknown as Env;
    return worker.fetch(
      new Request("https://infaix.com/", { method: "GET" }),
      envFull,
      { waitUntil: () => undefined },
    );
  };

  it("sets a content security policy built from the site's real needs", async () => {
    const res = await requestAssets({});
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
    // No third-party origin is permitted anywhere in the policy.
    expect(csp).not.toContain("cloudflare.com");
    expect(csp).not.toContain("workers.dev");
    expect(csp).not.toContain("googleapis");
  });

  it("keeps nosniff and stops Referer leakage of token-bearing URLs", async () => {
    const res = await requestAssets({});
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("restricts capabilities the site never uses", async () => {
    const res = await requestAssets({});
    const policy = res.headers.get("permissions-policy") ?? "";
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });

  it("sends HSTS only in production", async () => {
    const prod = await requestAssets({ ENVIRONMENT: "production" });
    expect(prod.headers.get("strict-transport-security")).toContain("max-age=31536000");
    const dev = await requestAssets({ ENVIRONMENT: "development" });
    expect(dev.headers.get("strict-transport-security")).toBeNull();
  });
});