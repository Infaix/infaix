import { describe, expect, it } from "vitest";
import {
  handleListUsers,
  handleLogin,
  handleRegister,
  handleSetAiAccess,
  handleVerifyEmail,
} from "../worker/auth/handlers";
import { canUseInfaixAI } from "../worker/auth/entitlement";
import { get, makeWorld, post, registerVerifyLogin, seedInvite, sessionCookieOf } from "./helpers";

const PASSWORD = "Correct-Horse-99-Battery";

async function ownerSession(w: ReturnType<typeof makeWorld>, email = "owner@infaix.com") {
  const { token } = await seedInvite(w, { role: "OWNER" });
  const reg = await handleRegister(w.ctx, post("/api/auth/register", { token, email, password: PASSWORD, displayName: "Owner" }));
  if (reg.status !== 201) throw new Error("owner setup failed");
  const outbox = await w.store.latestOutbox(email.toLowerCase(), "email_verification");
  if (!outbox) throw new Error("no verification mail");
  await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: outbox.link_token }));
  const login = await handleLogin(w.ctx, post("/api/auth/login", { email, password: PASSWORD }));
  const cookie = sessionCookieOf(login.headers);
  if (!cookie) throw new Error("no owner session");
  const user = await w.store.getUserByEmail(email.toLowerCase());
  if (!user) throw new Error("no owner user");
  return { userId: user.id, cookie };
}

async function plainUser(w: ReturnType<typeof makeWorld>, email: string) {
  const r = await registerVerifyLogin(w, { email });
  return r;
}

describe("owner AI access administration", () => {
  it("OWNER lists users with admin-safe fields only", async () => {
    const w = makeWorld();
    const owner = await ownerSession(w);
    await plainUser(w, "ada@infaix.com");
    const res = await handleListUsers(w.ctx, get("/api/admin/users", owner.cookie));
    expect(res.status).toBe(200);
    const users = (res.body as { users: Record<string, unknown>[] }).users;
    expect(users.length).toBe(2);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("token_hash");
    const ada = users.find((u) => u.email === "ada@infaix.com");
    expect(ada).toMatchObject({ role: "USER", status: "ACTIVE", ai_access: false });
  });

  it("OWNER enables then disables AI access (audited, effective)", async () => {
    const w = makeWorld();
    const owner = await ownerSession(w);
    const ada = await plainUser(w, "ada@infaix.com");
    expect(await canUseInfaixAI(w.store, ada.userId)).toBe(false);

    const on = await handleSetAiAccess(w.ctx, post(`/api/admin/users/${ada.userId}/ai-access`, { enabled: true }, owner.cookie), ada.userId);
    expect(on.status).toBe(200);
    expect((on.body as { user: { ai_access: boolean } }).user.ai_access).toBe(true);
    expect(await canUseInfaixAI(w.store, ada.userId)).toBe(true);

    const off = await handleSetAiAccess(w.ctx, post(`/api/admin/users/${ada.userId}/ai-access`, { enabled: false }, owner.cookie), ada.userId);
    expect(off.status).toBe(200);
    expect(await canUseInfaixAI(w.store, ada.userId)).toBe(false);

    const events = w.store.audits.filter((a) => a.event === "AI_ACCESS_ENABLED" || a.event === "AI_ACCESS_DISABLED");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ actor_user_id: owner.userId, target_user_id: ada.userId });
    const dump = JSON.stringify(w.store.audits);
    expect(dump).not.toContain("password");
  });

  it("ordinary USER is denied list and mutation (IDOR safe)", async () => {
    const w = makeWorld();
    await ownerSession(w);
    const ada = await plainUser(w, "ada@infaix.com");
    const bob = await plainUser(w, "bob@infaix.com");
    expect((await handleListUsers(w.ctx, get("/api/admin/users", ada.cookie))).status).toBe(403);
    const attempt = await handleSetAiAccess(w.ctx, post(`/api/admin/users/${bob.userId}/ai-access`, { enabled: true }, ada.cookie), bob.userId);
    expect(attempt.status).toBe(403);
    expect(await canUseInfaixAI(w.store, bob.userId)).toBe(false);
  });

  it("unauthenticated callers get 401/403, never data", async () => {
    const w = makeWorld();
    await ownerSession(w);
    const ada = await plainUser(w, "ada@infaix.com");
    expect((await handleListUsers(w.ctx, get("/api/admin/users"))).status).toBe(401);
    // mutation without any session: origin check runs first (no Origin here)
    const res = await handleSetAiAccess(w.ctx, post(`/api/admin/users/${ada.userId}/ai-access`, { enabled: true }), ada.userId);
    expect([401, 403]).toContain(res.status);
  });

  it("bootstrap token and ADMIN role cannot use owner endpoints", async () => {
    const w = makeWorld();
    const owner = await ownerSession(w);
    void owner;
    // ADMIN (non-owner) session
    const { token } = await seedInvite(w, { role: "ADMIN" });
    await handleRegister(w.ctx, post("/api/auth/register", { token, email: "admin@infaix.com", password: PASSWORD, displayName: "Admin" }));
    const ob = await w.store.latestOutbox("admin@infaix.com", "email_verification");
    if (!ob) throw new Error("no admin verification mail");
    await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: ob.link_token }));
    const login = await handleLogin(w.ctx, post("/api/auth/login", { email: "admin@infaix.com", password: PASSWORD }));
    const adminCookie = sessionCookieOf(login.headers);
    if (!adminCookie) throw new Error("no admin session");
    expect((await handleListUsers(w.ctx, get("/api/admin/users", adminCookie))).status).toBe(403);

    // bootstrap token: invite-scoped only, never owner-grade
    const bootEnv = { ...w.ctx.env, ADMIN_BOOTSTRAP_TOKEN: "bootstrap-secret-token-min-32" };
    const bootCtx = { ...w.ctx, env: bootEnv };
    const bootReq = new Request("https://infaix.com/api/admin/users", {
      headers: { "x-admin-token": "bootstrap-secret-token-min-32" },
    });
    expect((await handleListUsers(bootCtx, bootReq)).status).toBe(401);
  });

  it("invalid targets fail safe; self-modification rejected", async () => {
    const w = makeWorld();
    const owner = await ownerSession(w);
    const bad = await handleSetAiAccess(w.ctx, post("/api/admin/users/not-an-id/ai-access", { enabled: true }, owner.cookie), "not-an-id");
    expect(bad.status).toBe(404);
    const ghost = await handleSetAiAccess(
      w.ctx,
      post("/api/admin/users/usr_aaaaaaaaaaaaaaaaaaaaaaaa/ai-access", { enabled: true }, owner.cookie),
      "usr_aaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(ghost.status).toBe(404);
    const self = await handleSetAiAccess(
      w.ctx,
      post(`/api/admin/users/${owner.userId}/ai-access`, { enabled: false }, owner.cookie),
      owner.userId
    );
    expect(self.status).toBe(400);
    expect(await canUseInfaixAI(w.store, owner.userId)).toBe(true);
  });

  it("strict body validation rejects malformed and unknown fields", async () => {
    const w = makeWorld();
    const owner = await ownerSession(w);
    const ada = await plainUser(w, "ada@infaix.com");
    const cases: unknown[] = [
      {},
      { enabled: "yes" },
      { enabled: 1 },
      { enabled: true, role: "ADMIN" },
      { enabled: true, extra: "x" },
      { ENABLED: true },
      null,
      "enabled",
      [],
    ];
    for (const body of cases) {
      const res = await handleSetAiAccess(w.ctx, post(`/api/admin/users/${ada.userId}/ai-access`, body, owner.cookie), ada.userId);
      expect(res.status).toBe(400);
    }
    expect(await canUseInfaixAI(w.store, ada.userId)).toBe(false);
  });

  it("admin mutations are rate limited", async () => {
    const w = makeWorld({ RL_ADMIN_LIMIT: "2", RL_ADMIN_WINDOW: "3600" });
    const owner = await ownerSession(w);
    await handleListUsers(w.ctx, get("/api/admin/users", owner.cookie));
    await handleListUsers(w.ctx, get("/api/admin/users", owner.cookie));
    expect((await handleListUsers(w.ctx, get("/api/admin/users", owner.cookie))).status).toBe(429);
  });
});
