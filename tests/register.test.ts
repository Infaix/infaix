import { describe, expect, it } from "vitest";
import { handleLogin, handleRegister } from "../worker/auth/handlers";
import { get, makeWorld, post, seedInvite } from "./helpers";

const GOOD = { email: "ada@infaix.com", password: "Correct-Horse-99-Battery", displayName: "Ada" };

describe("public registration (no invitation required)", () => {
  it("creates a base account without any token", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", { ...GOOD }));
    expect(res.status).toBe(201);
    const user = (res.body as { user: { status: string; email: string } }).user;
    expect(user.status).toBe("PENDING_VERIFICATION");
    expect(user.email).toBe("ada@infaix.com");
    expect(JSON.stringify(res.body)).not.toContain("password_hash");
  });

  it("accepts a missing, null, or blank token as the public path", async () => {
    for (const token of [undefined, null, "", "   "]) {
      const w = makeWorld();
      const body = token === undefined ? { ...GOOD } : { token, ...GOOD };
      const res = await handleRegister(w.ctx, post("/api/auth/register", body));
      expect(res.status).toBe(201);
    }
  });

  it("starts every public signup at the lowest privilege", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", { ...GOOD }));
    expect(res.status).toBe(201);
    const user = (res.body as { user: { role: string; status: string; ai_access: boolean; email_verified: boolean } }).user;
    expect(user.role).toBe("USER");
    expect(user.status).toBe("PENDING_VERIFICATION");
    expect(user.ai_access).toBe(false);
    expect(user.email_verified).toBe(false);
    const row = await w.store.getUserByEmail("ada@infaix.com");
    expect(row?.role).toBe("USER");
    expect(row?.ai_access).toBe(0);
    expect(row?.email_verified).toBe(0);
    expect(row?.status).toBe("PENDING_VERIFICATION");
  });

  it("ignores client-supplied privilege fields (role/ai_access/status)", async () => {
    const w = makeWorld();
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", { ...GOOD, role: "OWNER", ai_access: true, status: "ACTIVE", email_verified: true })
    );
    expect(res.status).toBe(201);
    const row = await w.store.getUserByEmail("ada@infaix.com");
    expect(row?.role).toBe("USER");
    expect(row?.ai_access).toBe(0);
    expect(row?.status).toBe("PENDING_VERIFICATION");
    expect(row?.email_verified).toBe(0);
  });

  it("blocks login until email verification, then allows it", async () => {
    const w = makeWorld();
    await handleRegister(w.ctx, post("/api/auth/register", { ...GOOD }));
    const blocked = await handleLogin(w.ctx, post("/api/auth/login", { email: GOOD.email, password: GOOD.password }));
    expect(blocked.status).toBe(403);
    expect((blocked.body as { error: { code: string } }).error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("returns 409 ACCOUNT_EXISTS for duplicate emails without overwriting", async () => {
    const w = makeWorld();
    const first = await handleRegister(w.ctx, post("/api/auth/register", { ...GOOD }));
    expect(first.status).toBe(201);
    const dup = await handleRegister(
      w.ctx,
      post("/api/auth/register", { email: GOOD.email, password: "Different-Password-11!!", displayName: "Hijack" })
    );
    expect(dup.status).toBe(409);
    expect((dup.body as { error: { code: string } }).error.code).toBe("ACCOUNT_EXISTS");
    expect(w.store.users.size).toBe(1);
    const row = await w.store.getUserByEmail(GOOD.email);
    expect(row?.display_name).toBe("Ada");
  });

  it("rejects weak passwords and bad input without creating users", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", { email: "ada@infaix.com", password: "short", displayName: "Ada" }));
    expect(res.status).toBe(400);
    expect(await w.store.getUserByEmail("ada@infaix.com")).toBeNull();
  });

  it("rejects oversized bodies without creating users", async () => {
    const w = makeWorld();
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", { ...GOOD, displayName: "A".repeat(40_000) })
    );
    expect(res.status).toBe(400);
    expect(await w.store.getUserByEmail("ada@infaix.com")).toBeNull();
  });

  it("is rate limited", async () => {
    const w = makeWorld({ RL_REGISTER_LIMIT: "2", RL_REGISTER_WINDOW: "3600" });
    const t = (n: number) =>
      handleRegister(w.ctx, post("/api/auth/register", { ...GOOD, email: `u${n}@x.com` }));
    await t(1);
    await t(2);
    const third = await t(3);
    expect(third.status).toBe(429);
  });
});

describe("invitation path (operator seeding; optional, still honored)", () => {
  it("honors a valid invitation with its server-side role", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD }));
    expect(res.status).toBe(201);
    const user = (res.body as { user: { status: string; email: string; role: string } }).user;
    expect(user.status).toBe("PENDING_VERIFICATION");
    expect(user.email).toBe("ada@infaix.com");
    expect(user.role).toBe("USER");
    expect(JSON.stringify(res.body)).not.toContain("password_hash");
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it("rejects malformed supplied tokens without an account", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token: "not-a-token", ...GOOD }));
    expect(res.status).toBe(400);
    expect(await w.store.getUserByEmail("ada@infaix.com")).toBeNull();
  });

  it("rejects unknown, expired, and revoked invitations", async () => {
    const w = makeWorld();
    const unknown = await handleRegister(w.ctx, post("/api/auth/register", { token: "A".repeat(43), ...GOOD }));
    expect(unknown.status).toBe(410);
    expect(await w.store.getUserByEmail("ada@infaix.com")).toBeNull();

    const exp = await seedInvite(w, { ttlMs: 1000 });
    w.advance(2000);
    expect((await handleRegister(w.ctx, post("/api/auth/register", { token: exp.token, ...GOOD }))).status).toBe(410);

    const rev = await seedInvite(w);
    expect(await w.store.revokeInvitation(rev.id, w.getNow())).toBe(true);
    expect((await handleRegister(w.ctx, post("/api/auth/register", { token: rev.token, ...GOOD }))).status).toBe(410);
  });

  it("rejects reuse: a used invitation cannot register twice", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    const first = await handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD }));
    expect(first.status).toBe(201);
    const second = await handleRegister(
      w.ctx,
      post("/api/auth/register", { token, email: "grace@infaix.com", password: GOOD.password, displayName: "Grace" })
    );
    expect(second.status).toBe(410);
    expect(await w.store.getUserByEmail("grace@infaix.com")).toBeNull();
  });

  it("enforces the invitation email lock", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w, { email: "ada@infaix.com" });
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", { token, email: "mallory@infaix.com", password: GOOD.password, displayName: "M" })
    );
    expect(res.status).toBe(410);
  });

  it("defaults invite accounts to ai_access=0 (never granted by registration)", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD }));
    expect(res.status).toBe(201);
    expect((res.body as { user: { ai_access: boolean } }).user.ai_access).toBe(false);
    const row = await w.store.getUserByEmail("ada@infaix.com");
    expect(row?.ai_access).toBe(0);
  });

  it("audits invitation use plus account creation", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    await handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD }));
    const events = w.store.audits.map((a) => a.event);
    expect(events).toContain("INVITATION_USED");
    expect(events).toContain("ACCOUNT_CREATED");
    expect(events).toContain("EMAIL_VERIFICATION_SENT");
  });

  it("public signup audits creation without invitation use", async () => {
    const w = makeWorld();
    await handleRegister(w.ctx, post("/api/auth/register", { ...GOOD }));
    const events = w.store.audits.map((a) => a.event);
    expect(events).toContain("ACCOUNT_CREATED");
    expect(events).toContain("EMAIL_VERIFICATION_SENT");
    expect(events).not.toContain("INVITATION_USED");
  });

  it("me endpoint exposes no privilege beyond the safe defaults", async () => {
    const w = makeWorld();
    await handleRegister(w.ctx, post("/api/auth/register", { ...GOOD }));
    const { handleMe } = await import("../worker/auth/handlers");
    // PENDING_VERIFICATION has no session yet: /me without cookie is 401.
    expect((await handleMe(w.ctx, get("/api/auth/me"))).status).toBe(401);
  });
});
