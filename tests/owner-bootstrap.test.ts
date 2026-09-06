import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canUseInfaixAI } from "../worker/auth/entitlement";
import {
  handleListUsers,
  handleLogin,
  handleMe,
  handleRegister,
  handleSetAiAccess,
  handleVerifyEmail,
} from "../worker/auth/handlers";
import { handleApi } from "../worker/auth/router";
import { verifyPassword } from "../worker/auth/crypto";
import { get, makeWorld, ORIGIN, post, seedInvite, sessionCookieOf, type TestWorld } from "./helpers";

// Test-only generated credential. Never a real password; never reused outside
// this file; never printed (asserted below).
const OWNER_EMAIL = "cewetzels@outlook.com";
const OWNER_PASSWORD = "Owner-Bootstrap-Test-Password-99!";

interface MeBody {
  authenticated: boolean;
  user: { id: string; email: string; role: string; status: string; ai_access: boolean };
  ai: { enabled: boolean };
}

/** Mirrors scripts/bootstrap-owner.mjs phases against the real handlers. */
async function bootstrapOwnerFlow(w: TestWorld): Promise<{ userId: string; cookie: string; me: MeBody }> {
  const { token } = await seedInvite(w, { email: OWNER_EMAIL, role: "OWNER" });
  const reg = await handleRegister(
    w.ctx,
    post("/api/auth/register", { token, email: OWNER_EMAIL, password: OWNER_PASSWORD, displayName: "Infaix" })
  );
  expect(reg.status).toBe(201);
  const outbox = await w.store.latestOutbox(OWNER_EMAIL.toLowerCase(), "email_verification");
  if (!outbox) throw new Error("no verification outbox entry");
  const ver = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: outbox.link_token }));
  expect(ver.status).toBe(200);
  const login = await handleLogin(w.ctx, post("/api/auth/login", { email: OWNER_EMAIL, password: OWNER_PASSWORD }));
  expect(login.status).toBe(200);
  const cookie = sessionCookieOf(login.headers);
  if (!cookie) throw new Error("no session cookie");
  const me = await handleMe(w.ctx, get("/api/auth/me", cookie));
  expect(me.status).toBe(200);
  const userId = (me.body as MeBody).user.id;
  return { userId, cookie, me: me.body as MeBody };
}

describe("owner bootstrap: creation", () => {
  it("missing account -> OWNER, ACTIVE, verified, login works, AI enabled", async () => {
    const w = makeWorld();
    expect(await w.store.getUserByEmail(OWNER_EMAIL)).toBeNull();
    const { userId, me } = await bootstrapOwnerFlow(w);
    const row = await w.store.getUserById(userId);
    expect(row?.email).toBe(OWNER_EMAIL);
    expect(row?.display_name).toBe("Infaix");
    expect(row?.role).toBe("OWNER");
    expect(row?.status).toBe("ACTIVE");
    expect(row?.email_verified).toBe(1);
    expect(me.authenticated).toBe(true);
    expect(me.user.role).toBe("OWNER");
    expect(me.ai.enabled).toBe(true);
    expect(await canUseInfaixAI(w.store, userId)).toBe(true);
  });

  it("email-locked invite cannot register a different address", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w, { email: OWNER_EMAIL, role: "OWNER" });
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", { token, email: "mallory@example.com", password: OWNER_PASSWORD, displayName: "Mallory" })
    );
    expect(res.status).toBe(410);
    expect(await w.store.getUserByEmail("mallory@example.com")).toBeNull();
  });
});

describe("owner bootstrap: existing account safety", () => {
  it("second registration does not duplicate or overwrite", async () => {
    const w = makeWorld();
    const first = await bootstrapOwnerFlow(w);
    const { token } = await seedInvite(w, { email: OWNER_EMAIL, role: "OWNER" });
    const dup = await handleRegister(
      w.ctx,
      post("/api/auth/register", { token, email: OWNER_EMAIL, password: "Different-Password-11!!", displayName: "Hijack" })
    );
    expect(dup.status).toBe(410);
    // Exactly one row; original password and identity preserved.
    expect(w.store.users.size).toBe(1);
    const row = await w.store.getUserByEmail(OWNER_EMAIL);
    expect(row?.id).toBe(first.userId);
    expect(row?.display_name).toBe("Infaix");
    expect(row?.role).toBe("OWNER");
    expect(await verifyPassword(OWNER_PASSWORD, row?.password_hash ?? "")).toBe(true);
  });
});

describe("owner bootstrap: password handling", () => {
  it("stores only the PBKDF2 hash; verification works; secrets never leak", async () => {
    const w = makeWorld();
    const { userId } = await bootstrapOwnerFlow(w);
    const row = await w.store.getUserById(userId);
    expect(row?.password_hash.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(row?.password_hash).not.toContain(OWNER_PASSWORD);
    expect(await verifyPassword(OWNER_PASSWORD, row?.password_hash ?? "")).toBe(true);
    expect(await verifyPassword("Wrong-Password-00!", row?.password_hash ?? "")).toBe(false);
    const login = await handleLogin(w.ctx, post("/api/auth/login", { email: OWNER_EMAIL, password: OWNER_PASSWORD }));
    const dump = JSON.stringify(login.body) + JSON.stringify(w.store.audits);
    expect(dump).not.toContain(OWNER_PASSWORD);
    expect(dump).not.toContain(row?.password_hash ?? "impossible-marker");
    expect(dump).not.toContain("infaix_session");
  });
});

describe("owner bootstrap: authorization", () => {
  it("OWNER reaches owner-only endpoints", async () => {
    const w = makeWorld();
    const owner = await bootstrapOwnerFlow(w);
    // owner-only user list
    expect((await handleListUsers(w.ctx, get("/api/admin/users", owner.cookie))).status).toBe(200);
    // owner grants AI access to a normal user (IDOR-safe: explicit target id)
    const { token } = await seedInvite(w);
    await handleRegister(w.ctx, post("/api/auth/register", { token, email: "user@infaix.com", password: OWNER_PASSWORD, displayName: "User" }));
    const target = await w.store.getUserByEmail("user@infaix.com");
    if (!target) throw new Error("missing user");
    const grant = await handleSetAiAccess(w.ctx, post(`/api/admin/users/${target.id}/ai-access`, { enabled: true }, owner.cookie), target.id);
    expect(grant.status).toBe(200);
    expect((await w.store.getUserById(target.id))?.ai_access).toBe(1);
  });

  it("authenticated non-owner sessions are denied owner endpoints (403)", async () => {
    const w = makeWorld();
    const owner = await bootstrapOwnerFlow(w);
    // Active USER session via direct active row (bypasses PENDING gate for this check)
    const { token } = await seedInvite(w);
    await handleRegister(w.ctx, post("/api/auth/register", { token, email: "user@infaix.com", password: OWNER_PASSWORD, displayName: "User" }));
    const u = await w.store.getUserByEmail("user@infaix.com");
    if (!u) throw new Error("missing user");
    await w.store.updateUser(u.id, { status: "ACTIVE", email_verified: 1, updated_at: w.getNow() });
    const login = await handleLogin(w.ctx, post("/api/auth/login", { email: "user@infaix.com", password: OWNER_PASSWORD }));
    const userCookie = sessionCookieOf(login.headers);
    if (!userCookie) throw new Error("no user session");
    expect((await handleListUsers(w.ctx, get("/api/admin/users", userCookie))).status).toBe(403);
    expect((await handleSetAiAccess(w.ctx, post(`/api/admin/users/${u.id}/ai-access`, { enabled: true }, userCookie), u.id)).status).toBe(403);
    // anonymous
    expect((await handleListUsers(w.ctx, get("/api/admin/users"))).status).toBe(401);
    expect((await handleSetAiAccess(w.ctx, post(`/api/admin/users/${u.id}/ai-access`, { enabled: true }), u.id)).status).toBe(401);
    void owner;
  });
});

describe("owner bootstrap: entitlement matrix", () => {
  it("OWNER+ACTIVE enabled; USER ai0 denied; USER ai1 allowed; DISABLED denied", async () => {
    const w = makeWorld();
    const owner = await bootstrapOwnerFlow(w);
    expect(await canUseInfaixAI(w.store, owner.userId)).toBe(true);
    const { token } = await seedInvite(w);
    await handleRegister(w.ctx, post("/api/auth/register", { token, email: "user@infaix.com", password: OWNER_PASSWORD, displayName: "User" }));
    const u = await w.store.getUserByEmail("user@infaix.com");
    if (!u) throw new Error("missing user");
    await w.store.updateUser(u.id, { status: "ACTIVE", email_verified: 1, updated_at: w.getNow() });
    expect(await canUseInfaixAI(w.store, u.id)).toBe(false);
    await w.store.updateUser(u.id, { ai_access: 1, updated_at: w.getNow() });
    expect(await canUseInfaixAI(w.store, u.id)).toBe(true);
    await w.store.updateUser(owner.userId, { status: "DISABLED", updated_at: w.getNow() });
    expect(await canUseInfaixAI(w.store, owner.userId)).toBe(false);
  });
});

describe("owner bootstrap: no privilege-escalation surface", () => {
  it("exposes no bootstrap HTTP endpoint", async () => {
    const w = makeWorld();
    for (const path of ["/api/bootstrap-owner", "/api/auth/bootstrap-owner", "/api/admin/bootstrap", "/api/owner/bootstrap"]) {
      const res = await handleApi(post(path, {}), w.ctx.env, new URL(`${ORIGIN}${path}`));
      expect(res?.status).toBe(404);
    }
    for (const src of ["worker/auth/router.ts", "worker/auth/handlers.ts", "worker/auth/ai.ts"]) {
      const text = readFileSync(src, "utf8");
      // No owner-bootstrap endpoint/handler may exist. (ADMIN_BOOTSTRAP_TOKEN
      // is the pre-existing invite-scoped workflow and is allowed.)
      expect(text).not.toMatch(/bootstraps?-owner|owner-?bootstrap|handleBootstrap/i);
      expect(text).not.toContain("/bootstrap");
    }
  });

  it("bootstrap script is fixed-identity, no-echo, production-gated, secret-safe", () => {
    const src = readFileSync("scripts/bootstrap-owner.mjs", "utf8");
    // Fixed identity (no arbitrary email/role promotion).
    expect(src).toContain('cewetzels@outlook.com');
    expect(src).toContain('"--email"');
    expect(src).toContain('"--role"');
    expect(src).toContain('"--password"');
    // No-echo prompting + documented env fallback (names only, never values).
    expect(src).toContain("setRawMode");
    expect(src).toContain("INFAIX_OWNER_PASSWORD");
    // Production gate.
    expect(src).toContain("--confirm-production");
    // No new server endpoint client.
    expect(src).not.toContain("/api/bootstrap");
    // No secret values flow into console output: no console call interpolates
    // or passes a secret-holding variable.
    const calls = src.match(/console\.(log|error)\([\s\S]*?\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).not.toMatch(/[$,({]\s*(password|adminToken|inviteToken|verifyToken)\b/);
    }
    // Audit convention for the optional finalize step.
    expect(src).toContain("audit_log");
  });
});
