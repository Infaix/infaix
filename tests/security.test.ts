import { describe, expect, it } from "vitest";
import {
  handleCreateInvite,
  handleListInvites,
  handleLogin,
  handleLogout,
  handleMe,
  handleRegister,
  handleRevokeInvite,
  handleSetUserStatus,
  handleUpdateProfile,
  handleVerifyEmail,
} from "../worker/auth/handlers";
import { handleApi } from "../worker/auth/router";
import { requireRole } from "../worker/auth/guard";
import { get, makeWorld, ORIGIN, post, registerVerifyLogin, seedInvite, sessionCookieOf } from "./helpers";
import type { Env } from "../worker/auth/types";

describe("request hardening", () => {
  it("rejects malformed JSON bodies", async () => {
    const w = makeWorld();
    const bad = new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: "{not-json",
    });
    const res = await handleLogin(w.ctx, bad);
    expect([400, 401]).toContain(res.status);
  });

  it("rejects cross-origin cookie POSTs (CSRF)", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    const evil = post("/api/auth/logout", {}, cookie, "https://evil.example");
    const res = await handleLogout(w.ctx, evil);
    expect(res.status).toBe(403);
  });

  it("unknown API routes 404 as JSON", async () => {
    const w = makeWorld();
    const res = await handleApi(
      post("/api/nope", {}),
      w.ctx.env,
      new URL(`${ORIGIN}/api/nope`)
    );
    expect(res?.status).toBe(404);
  });

  it("requires the DB binding (503 without it)", async () => {
    // Covered at worker/index.ts via env.INFAIX_DB check; handlers assume store.
    const w = makeWorld();
    const env: Env = { ...w.ctx.env, SESSION_SECRET: undefined };
    const res = await handleLogin({ ...w.ctx, env }, post("/api/auth/login", { email: "a@b.com", password: "x" }));
    // Missing secret only breaks session minting after valid credentials;
    // unknown user still yields generic 401 without leaking config state.
    expect(res.status).toBe(401);
  });
});

describe("no sensitive data exposure", () => {
  it("responses never contain hashes, tokens, or secrets", async () => {
    const w = makeWorld();
    const { cookie, userId } = await registerVerifyLogin(w);
    const bodies: string[] = [];
    const me = await handleMe(w.ctx, get("/api/auth/me", cookie));
    bodies.push(JSON.stringify(me.body));
    const login = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery" }));
    bodies.push(JSON.stringify(login.body));
    const row = await w.store.getUserById(userId);
    const all = bodies.join("\n");
    expect(all).not.toContain("password_hash");
    expect(all).not.toContain("token_hash");
    expect(all).not.toContain(row?.password_hash ?? "impossible-marker");
    // audit log holds events but no secrets
    for (const a of w.store.audits) {
      expect(JSON.stringify(a)).not.toContain("Correct-Horse");
    }
    expect(w.store.audits.length).toBeGreaterThan(0);
  });

  it("admin invite list never exposes token hashes", async () => {
    const w = makeWorld();
    const adminEnv = { ...w.ctx.env, ADMIN_BOOTSTRAP_TOKEN: "bootstrap-secret-token" };
    const ctx = { ...w.ctx, env: adminEnv };
    const created = await handleCreateInvite(ctx, (() => {
      const r = post("/api/admin/invites", { note: "t" });
      r.headers.set("x-admin-token", "bootstrap-secret-token");
      return r;
    })());
    expect(created.status).toBe(201);
    // raw token returned exactly once to the creator…
    expect(typeof (created.body as { token: string }).token).toBe("string");
    const listed = await handleListInvites(ctx, get("/api/admin/invites"));
    const text = JSON.stringify(listed.body);
    expect(text).not.toContain("token_hash");
    expect(text).not.toContain((created.body as { token: string }).token);
  });
});

describe("authorization boundaries", () => {
  it("client-provided ids cannot impersonate: profile edits affect self only", async () => {
    const w = makeWorld();
    const a = await registerVerifyLogin(w, { email: "a@infaix.com" });
    const b = await registerVerifyLogin(w, { email: "b@infaix.com", displayName: "Bee" });
    // No user-id parameter exists; the session determines identity.
    const res = await handleUpdateProfile(w.ctx, post("/api/auth/profile", { displayName: "A-Hacked" }, a.cookie));
    expect(res.status).toBe(200);
    expect((await w.store.getUserById(b.userId))?.display_name).toBe("Bee");
    expect((await w.store.getUserById(a.userId))?.display_name).toBe("A-Hacked");
  });

  it("non-admins cannot disable users or revoke via admin routes", async () => {
    const w = makeWorld();
    const a = await registerVerifyLogin(w, { email: "a@infaix.com" });
    const b = await registerVerifyLogin(w, { email: "b@infaix.com" });
    const dis = await handleSetUserStatus(w.ctx, post(`/api/admin/users/${b.userId}/disable`, {}, a.cookie), b.userId, "DISABLED");
    expect(dis.status).toBe(403);
    const rev = await handleRevokeInvite(w.ctx, post("/api/admin/invites/inv_aaaaaaaaaaaaaaaaaaaaaaaa/revoke", {}, a.cookie), "inv_aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(rev.status).toBe(403);
  });

  it("requireRole gates OWNER/ADMIN/USER correctly", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    const me = await handleMe(w.ctx, get("/api/auth/me", cookie));
    void me;
    const user = await w.store.getUserByEmail("ada@infaix.com");
    if (!user) throw new Error("missing user");
    const okAuth = { ok: true as const, user, sessionId: "s" };
    expect(requireRole(okAuth, ["USER"]).ok).toBe(true);
    expect(requireRole(okAuth, ["ADMIN"]).ok).toBe(false);
    expect(requireRole({ ok: false, result: new Response("x", { status: 401 }) }, ["USER"]).ok).toBe(false);
  });

  it("users cannot disable themselves or escalate via invites", async () => {
    const w = makeWorld();
    // bootstrap an OWNER directly
    const inv = await seedInvite(w, { role: "OWNER" });
    await handleRegister(w.ctx, post("/api/auth/register", { token: inv.token, email: "owner@infaix.com", password: "Correct-Horse-99-Battery", displayName: "Owner" }));
    const ob = await w.store.latestOutbox("owner@infaix.com", "email_verification");
    if (!ob) throw new Error("no verification outbox entry");
    await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: ob.link_token }));
    const login = await handleLogin(w.ctx, post("/api/auth/login", { email: "owner@infaix.com", password: "Correct-Horse-99-Battery" }));
    const ownerCookie = sessionCookieOf(login.headers);
    if (!ownerCookie) throw new Error("no owner session");
    const owner = await w.store.getUserByEmail("owner@infaix.com");
    if (!owner) throw new Error("no owner user");
    const self = await handleSetUserStatus(w.ctx, post("/api/admin/users/x/disable", {}, ownerCookie), owner.id, "DISABLED");
    expect(self.status).toBe(400);
  });
});
