import { describe, expect, it } from "vitest";
import { handleLogin, handleLogout, handleMe, handleRegister } from "../worker/auth/handlers";
import { get, makeWorld, post, registerVerifyLogin, seedInvite, sessionCookieOf } from "./helpers";

describe("login", () => {
  it("succeeds with correct credentials and sets a secure cookie", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    expect(cookie.startsWith("infaix_session=")).toBe(true);
    // login again to inspect the Set-Cookie attributes
    const again = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery" }));
    expect(again.status).toBe(200);
    const set = again.headers?.["set-cookie"] ?? "";
    expect(set).toContain("HttpOnly");
    expect(set).toContain("SameSite=Lax");
    expect(set).toContain("Secure");
    expect(set).toContain("Path=/");
  });

  it("fails with incorrect credentials (generic message)", async () => {
    const w = makeWorld();
    await registerVerifyLogin(w);
    const res = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Wrong-Password-00!" }));
    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("INVALID_CREDENTIALS");
  });

  it("fails identically for unknown emails (no enumeration)", async () => {
    const w = makeWorld();
    const res = await handleLogin(w.ctx, post("/api/auth/login", { email: "nobody@infaix.com", password: "Wrong-Password-00!" }));
    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string; message: string } }).error).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
    });
  });

  it("fails for unverified and disabled accounts", async () => {
    const w = makeWorld();
    const { userId } = await registerVerifyLogin(w);
    // unverified sibling: register but never verify
    const { token } = await seedInvite(w);
    await handleRegister(w.ctx, post("/api/auth/register", { token, email: "new@infaix.com", password: "Correct-Horse-99-Battery", displayName: "New" }));
    const pending = await handleLogin(w.ctx, post("/api/auth/login", { email: "new@infaix.com", password: "Correct-Horse-99-Battery" }));
    expect(pending.status).toBe(403);

    await w.store.updateUser(userId, { status: "DISABLED", updated_at: w.getNow() });
    const disabled = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery" }));
    expect(disabled.status).toBe(403);
    expect((disabled.body as { error: { code: string } }).error.code).toBe("ACCOUNT_DISABLED");
  });

  it("carries the session only via Set-Cookie, never in the body", async () => {
    const w = makeWorld();
    await registerVerifyLogin(w);
    const res = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery" }));
    expect(res.status).toBe(200);
    expect(res.headers?.["set-cookie"]).toContain("infaix_session=");
    const text = JSON.stringify(res.body).toLowerCase();
    expect(text).not.toContain("infaix_session");
    expect(text).not.toContain("set-cookie");
    expect(text).not.toContain("token");
  });

  it("rejects invalid input and is rate limited", async () => {
    const w = makeWorld({ RL_LOGIN_LIMIT: "2", RL_LOGIN_WINDOW: "600" });
    const bad = await handleLogin(w.ctx, post("/api/auth/login", { email: "not-an-email", password: "x" }));
    expect(bad.status).toBe(401);
    await handleLogin(w.ctx, post("/api/auth/login", { email: "a@b.com", password: "Wrong-Password-00!" }));
    const limited = await handleLogin(w.ctx, post("/api/auth/login", { email: "c@d.com", password: "Wrong-Password-00!" }));
    expect(limited.status).toBe(429);
  });
});

describe("sessions", () => {
  it("login creates a session; /me requires it", async () => {
    const w = makeWorld();
    const anon = await handleMe(w.ctx, get("/api/auth/me"));
    expect(anon.status).toBe(401);
    const { cookie } = await registerVerifyLogin(w);
    const me = await handleMe(w.ctx, get("/api/auth/me", cookie));
    expect(me.status).toBe(200);
    expect((me.body as { user: { email: string } }).user.email).toBe("ada@infaix.com");
    expect(JSON.stringify(me.body)).not.toContain("password_hash");
  });

  it("logout invalidates the session server-side", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    const out = await handleLogout(w.ctx, post("/api/auth/logout", {}, cookie));
    expect(out.status).toBe(200);
    expect(out.headers?.["set-cookie"]).toContain("Max-Age=0");
    const me = await handleMe(w.ctx, get("/api/auth/me", cookie));
    expect(me.status).toBe(401);
  });

  it("expired sessions are rejected", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    w.advance(31 * 24 * 60 * 60 * 1000);
    const me = await handleMe(w.ctx, get("/api/auth/me", cookie));
    expect(me.status).toBe(401);
  });

  it("disabled accounts lose protected access immediately", async () => {
    const w = makeWorld();
    const { cookie, userId } = await registerVerifyLogin(w);
    expect((await handleMe(w.ctx, get("/api/auth/me", cookie))).status).toBe(200);
    await w.store.updateUser(userId, { status: "DISABLED", updated_at: w.getNow() });
    await w.store.deleteUserSessions(userId);
    expect((await handleMe(w.ctx, get("/api/auth/me", cookie))).status).toBe(401);
  });

  it("rotates tokens: two logins yield independent sessions", async () => {
    const w = makeWorld();
    const first = await registerVerifyLogin(w);
    const second = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery" }));
    const cookie2 = sessionCookieOf(second.headers);
    if (!cookie2) throw new Error("no session cookie");
    expect(cookie2).not.toBe(first.cookie);
    expect((await handleMe(w.ctx, get("/api/auth/me", cookie2))).status).toBe(200);
  });
});
