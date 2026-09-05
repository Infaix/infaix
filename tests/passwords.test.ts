import { describe, expect, it } from "vitest";
import {
  handleChangePassword,
  handleLogin,
  handleMe,
  handleRegister,
  handleRequestPasswordReset,
  handleRequestVerification,
  handleResetPassword,
  handleVerifyEmail,
} from "../worker/auth/handlers";
import { get, makeWorld, post, registerVerifyLogin, seedInvite, sessionCookieOf } from "./helpers";

describe("password storage and change", () => {
  it("never stores plaintext", async () => {
    const w = makeWorld();
    const { userId } = await registerVerifyLogin(w, { password: "Super-Secret-1234!" });
    const row = await w.store.getUserById(userId);
    if (!row) throw new Error("missing user");
    expect(row.password_hash).not.toContain("Super-Secret");
    expect(row.password_hash.startsWith("pbkdf2-sha256$")).toBe(true);
  });

  it("change works with current password; old stops working; others signed out", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    const other = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery" }));
    const otherCookie = sessionCookieOf(other.headers);
    if (!otherCookie) throw new Error("no session cookie");

    const bad = await handleChangePassword(w.ctx, post("/api/auth/change-password", { currentPassword: "Wrong-Password-00!", newPassword: "Brand-New-Password-77!" }, cookie));
    expect(bad.status).toBe(401);

    const ok = await handleChangePassword(w.ctx, post("/api/auth/change-password", { currentPassword: "Correct-Horse-99-Battery", newPassword: "Brand-New-Password-77!" }, cookie));
    expect(ok.status).toBe(200);

    const oldLogin = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery" }));
    expect(oldLogin.status).toBe(401);
    const newLogin = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Brand-New-Password-77!" }));
    expect(newLogin.status).toBe(200);
    // other session was invalidated
    expect((await handleMe(w.ctx, get("/api/auth/me", otherCookie))).status).toBe(401);
    // current session survives
    expect((await handleMe(w.ctx, get("/api/auth/me", cookie))).status).toBe(200);
  });
});

describe("password reset foundation", () => {
  async function requestToken(w: ReturnType<typeof makeWorld>, email: string): Promise<string> {
    const res = await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email }));
    expect(res.status).toBe(200);
    const outbox = await w.store.latestOutbox(email, "password_reset");
    if (!outbox) throw new Error("no reset outbox entry");
    return outbox.link_token;
  }

  it("reset works, cannot be reused, signs out all sessions", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    const token = await requestToken(w, "ada@infaix.com");
    const done = await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token, newPassword: "Fresh-Start-Password-88!" }));
    expect(done.status).toBe(200);
    expect(done.status).toBe(200);

    const reuse = await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token, newPassword: "Another-Password-99!" }));
    expect(reuse.status).toBe(410);

    const { handleMe } = await import("../worker/auth/handlers");
    expect((await handleMe(w.ctx, get("/api/auth/me", cookie))).status).toBe(401);
    const login = await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Fresh-Start-Password-88!" }));
    expect(login.status).toBe(200);
  });

  it("reset tokens expire and unknown emails get neutral responses", async () => {
    const w = makeWorld();
    await registerVerifyLogin(w);
    const token = await requestToken(w, "ada@infaix.com");
    w.advance(2 * 60 * 60 * 1000);
    const expired = await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token, newPassword: "Fresh-Start-Password-88!" }));
    expect(expired.status).toBe(410);

    const unknown = await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "ghost@infaix.com" }));
    expect(unknown.status).toBe(200);
    expect(await w.store.latestOutbox("ghost@infaix.com", "password_reset")).toBeNull();
  });

  it("is rate limited", async () => {
    const w = makeWorld({ RL_RESET_LIMIT: "1", RL_RESET_WINDOW: "3600" });
    await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "a@b.com" }));
    const limited = await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "a@b.com" }));
    expect(limited.status).toBe(429);
  });
});

describe("email verification", () => {
  it("verifies, activates, and cannot be reused", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    await handleRegister(w.ctx, post("/api/auth/register", { token, email: "ada@infaix.com", password: "Correct-Horse-99-Battery", displayName: "Ada" }));
    const ob = await w.store.latestOutbox("ada@infaix.com", "email_verification");
    if (!ob) throw new Error("no verification outbox entry");
    const vToken = ob.link_token;
    const ok = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: vToken }));
    expect(ok.status).toBe(200);
    const user = await w.store.getUserByEmail("ada@infaix.com");
    if (!user) throw new Error("missing user");
    expect(user.status).toBe("ACTIVE");
    expect(user.email_verified).toBe(1);
    const reuse = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: vToken }));
    expect(reuse.status).toBe(410);
  });

  it("resend is neutral and rate limited", async () => {
    const w = makeWorld({ RL_VERIFY_LIMIT: "1", RL_VERIFY_WINDOW: "3600" });
    const first = await handleRequestVerification(w.ctx, post("/api/auth/request-verification", { email: "nobody@infaix.com" }));
    expect(first.status).toBe(200);
    const second = await handleRequestVerification(w.ctx, post("/api/auth/request-verification", { email: "nobody@infaix.com" }));
    expect(second.status).toBe(429);
  });
});
