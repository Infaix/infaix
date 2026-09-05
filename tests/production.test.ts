import { describe, expect, it } from "vitest";
import { allowedOrigins, checkRequestOrigin, corsHeaders, handlePreflight, validatedCorsOrigin } from "../worker/auth/cors";
import { canUseInfaixAI } from "../worker/auth/entitlement";
import { handleLogin, handleMe } from "../worker/auth/handlers";
import { buildClearCookie, buildSetCookie, cookieScope, unsignToken } from "../worker/auth/sessions";
import type { Env } from "../worker/auth/types";
import worker from "../worker/index";
import { get, makeWorld, ORIGIN, post, registerVerifyLogin } from "./helpers";

const PROD_ENV = { ENVIRONMENT: "production" };
const AI_ORIGIN = "https://ai.infaix.com";
const SITE_ORIGIN = "https://infaix.com";

describe("production session cookie", () => {
  it("uses Domain=.infaix.com, SameSite=None, Secure, HttpOnly in production", async () => {
    const w = makeWorld(PROD_ENV);
    const { cookie } = await registerVerifyLogin(w);
    const login = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery" }));
    const set = login.headers?.["set-cookie"] ?? "";
    expect(set).toContain("Domain=.infaix.com");
    expect(set).toContain("SameSite=None");
    expect(set).toContain("Secure");
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Path=/");
    expect(cookie).toContain("infaix_session=");
    // session still validates (round-trip through the stricter cookie)
    expect((await handleMe(w.ctx, get("/api/auth/me", cookie))).status).toBe(200);
  });

  it("keeps host-only Lax cookies outside production", () => {
    const scope = cookieScope({ INFAIX_DB: null as never } as Env);
    expect(scope).toEqual({ sameSite: "Lax" });
    const set = buildSetCookie("t.s", false, 60, scope);
    expect(set).not.toContain("Domain=");
    expect(set).toContain("SameSite=Lax");
  });

  it("clear-cookie carries Domain in production (or the cookie survives)", () => {
    const scope = cookieScope({ INFAIX_DB: null as never, ENVIRONMENT: "production" } as Env);
    expect(buildClearCookie(true, scope)).toContain("Domain=.infaix.com");
  });

  it("honors COOKIE_DOMAIN override", () => {
    const scope = cookieScope({ INFAIX_DB: null as never, ENVIRONMENT: "production", COOKIE_DOMAIN: ".example.com" } as Env);
    expect(scope.domain).toBe(".example.com");
  });

  it("rejects foreign-secret and malformed signatures (fail closed)", async () => {
    const w = makeWorld();
    expect(await unsignToken(w.ctx.env, "token." + "0".repeat(64))).toBeNull();
    expect(await unsignToken(w.ctx.env, "no-dot-here")).toBeNull();
    expect(await unsignToken(w.ctx.env, "")).toBeNull();
    const other = makeWorld({ SESSION_SECRET: "different-secret-min-32-chars-00" });
    const { cookie } = await registerVerifyLogin(w);
    // cookie signed under w's secret must not validate under other's secret
    const { verifySession } = await import("../worker/auth/sessions");
    const res = await verifySession(
      { store: other.store, env: other.ctx.env, now: other.ctx.now, ip: null, userAgent: null, secure: true },
      cookie
    );
    expect(res).toBeNull();
  });
});

describe("CORS allowlist", () => {
  const env = (extra: Partial<Env> = {}): Env =>
    ({ INFAIX_DB: null as never, ENVIRONMENT: "production", ...extra }) as Env;

  it("allows the worker origin plus both INFAIX origins in production", () => {
    expect(allowedOrigins(env(), SITE_ORIGIN).sort()).toEqual([AI_ORIGIN, SITE_ORIGIN].sort());
  });

  it("denies unknown origins without reflection", () => {
    const req = new Request(`${ORIGIN}/api/auth/me`, { headers: { origin: "https://evil.example" } });
    expect(validatedCorsOrigin(req, env(), SITE_ORIGIN)).toBeNull();
    expect(corsHeaders(req, env(), SITE_ORIGIN)).toEqual({});
  });

  it("allows ai.infaix.com with credentials", () => {
    const req = new Request(`${ORIGIN}/api/auth/me`, { headers: { origin: AI_ORIGIN } });
    const h = corsHeaders(req, env(), SITE_ORIGIN);
    expect(h["access-control-allow-origin"]).toBe(AI_ORIGIN);
    expect(h["access-control-allow-credentials"]).toBe("true");
    expect(h["vary"]).toBe("Origin");
  });

  it("allows localhost only outside production", () => {
    const devReq = new Request(`${ORIGIN}/api/auth/me`, { headers: { origin: "http://localhost:3000" } });
    expect(validatedCorsOrigin(devReq, { ...env(), ENVIRONMENT: "development" }, "http://localhost:3000")).toBe("http://localhost:3000");
    expect(validatedCorsOrigin(devReq, env(), SITE_ORIGIN)).toBeNull();
  });

  it("answers preflight for allowed origins, 403 otherwise", () => {
    const ok = new Request(`${ORIGIN}/api/ai/chat`, { method: "OPTIONS", headers: { origin: AI_ORIGIN } });
    const res = handlePreflight(ok, env(), SITE_ORIGIN);
    expect(res?.status).toBe(204);
    expect(res?.headers.get("access-control-allow-origin")).toBe(AI_ORIGIN);
    expect(res?.headers.get("access-control-allow-credentials")).toBe("true");
    const bad = new Request(`${ORIGIN}/api/ai/chat`, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
    expect(handlePreflight(bad, env(), SITE_ORIGIN)?.status).toBe(403);
    const nonApi = new Request(`${ORIGIN}/page`, { method: "OPTIONS", headers: { origin: AI_ORIGIN } });
    expect(handlePreflight(nonApi, env(), SITE_ORIGIN)).toBeNull();
  });

  it("state-changing requests fail closed without an allowlisted origin", async () => {
    const w = makeWorld();
    const naked = new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "x" }),
    });
    expect(checkRequestOrigin(naked, w.ctx.env, ORIGIN)).toBe(false);
    const evil = new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: "{}",
    });
    expect(checkRequestOrigin(evil, w.ctx.env, ORIGIN)).toBe(false);
    const good = new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: AI_ORIGIN },
      body: "{}",
    });
    expect(checkRequestOrigin(good, w.ctx.env, ORIGIN)).toBe(true);
  });

  it("supports additive CORS_EXTRA_ORIGINS (https only in production)", () => {
    const e = env({ CORS_EXTRA_ORIGINS: "https://preview.infaix.com, http://localhost:9999" });
    expect(allowedOrigins(e, SITE_ORIGIN)).toContain("https://preview.infaix.com");
    expect(allowedOrigins(e, SITE_ORIGIN)).not.toContain("http://localhost:9999");
  });
});

describe("AI entitlement (canUseInfaixAI)", () => {
  it("denies by default, grants explicitly, OWNER bypasses, DISABLED never", async () => {
    const w = makeWorld();
    const { userId } = await registerVerifyLogin(w, { email: "u@infaix.com" });
    // PENDING user from registerVerifyLogin is ACTIVE (verified in helper)
    expect(await canUseInfaixAI(w.store, userId)).toBe(false); // default deny
    await w.store.updateUser(userId, { ai_access: 1, updated_at: w.getNow() });
    expect(await canUseInfaixAI(w.store, userId)).toBe(true);
    await w.store.updateUser(userId, { status: "DISABLED", updated_at: w.getNow() });
    expect(await canUseInfaixAI(w.store, userId)).toBe(false); // disabled wins over grant
    expect(await canUseInfaixAI(w.store, "usr_nonexistent000000000000")).toBe(false);
    expect(await canUseInfaixAI(w.store, "")).toBe(false);
    const owner = await registerVerifyLogin(w, { email: "owner@infaix.com" });
    await w.store.updateUser(owner.userId, { role: "OWNER", updated_at: w.getNow() });
    expect(await canUseInfaixAI(w.store, owner.userId)).toBe(true);
  });
});

describe("GET /api/auth/me contract", () => {
  it("returns authenticated identity + AI grant, never secrets", async () => {
    const w = makeWorld();
    const { cookie, userId } = await registerVerifyLogin(w);
    await w.store.updateUser(userId, { ai_access: 1, updated_at: w.getNow() });
    const res = await handleMe(w.ctx, get("/api/auth/me", cookie));
    expect(res.status).toBe(200);
    const body = res.body as { authenticated: boolean; user: { id: string }; ai: { enabled: boolean } };
    expect(body.authenticated).toBe(true);
    expect(body.user.id).toBe(userId);
    expect(body.ai.enabled).toBe(true);
    const text = JSON.stringify(body);
    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("token_hash");
  });

  it("stays 401 when unauthenticated", async () => {
    const w = makeWorld();
    expect((await handleMe(w.ctx, get("/api/auth/me"))).status).toBe(401);
  });
});

describe("no production auth bypass", () => {
  it("rogue env vars cannot authenticate anyone (hermetic)", async () => {
    process.env.DEV_AUTH_USER = "admin@infaix.com";
    process.env.BYPASS_AUTH = "1";
    try {
      const w = makeWorld();
      expect((await handleMe(w.ctx, get("/api/auth/me"))).status).toBe(401);
      const login = await handleLogin(w.ctx, post("/api/auth/login", { email: "admin@infaix.com", password: "whatever-Valid-1!" }));
      expect(login.status).toBe(401);
    } finally {
      delete process.env.DEV_AUTH_USER;
      delete process.env.BYPASS_AUTH;
    }
  });

  it("production API refuses to run without a real session secret", async () => {
    const assets = { fetch: async () => new Response("x") };
    const noSecret = { INFAIX_DB: {} as never, ENVIRONMENT: "production", ASSETS: assets } as unknown as Env;
    const res = await worker.fetch(
      new Request("https://infaix.com/api/auth/me"),
      noSecret,
      { waitUntil() {} }
    );
    expect(res.status).toBe(503);
    // ...while a configured secret proceeds past the guard (fails later on
    // the fake DB, proving the guard — not the DB — was the gate).
    const withSecret = { ...noSecret, SESSION_SECRET: "production-secret-min-32-chars!!" };
    const res2 = await worker.fetch(
      new Request("https://infaix.com/api/auth/me"),
      withSecret,
      { waitUntil() {} }
    );
    expect(res2.status).not.toBe(503);
  });

  it("audit log never captures session tokens or passwords", async () => {
    const w = makeWorld();
    const password = "Audit-Secrecy-Check-123!";
    const { cookie } = await registerVerifyLogin(w, { email: "audit@infaix.com", password });
    const { handleLogout } = await import("../worker/auth/handlers");
    await handleLogout(w.ctx, post("/api/auth/logout", {}, cookie));
    const token = decodeURIComponent(cookie.split("=")[1]).split(".")[0];
    const dump = JSON.stringify(w.store.audits);
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(password);
    expect(dump).not.toContain("password_hash");
  });
});
