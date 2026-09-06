import { describe, expect, it } from "vitest";
import { handleRegister } from "../worker/auth/handlers";
import { makeWorld, post, seedInvite } from "./helpers";

const GOOD = { email: "ada@infaix.com", password: "Correct-Horse-99-Battery", displayName: "Ada" };

describe("invite-only registration", () => {
  it("allows registration with a valid invitation", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD }));
    expect(res.status).toBe(201);
    const user = (res.body as { user: { status: string; email: string } }).user;
    expect(user.status).toBe("PENDING_VERIFICATION");
    expect(user.email).toBe("ada@infaix.com");
    expect(JSON.stringify(res.body)).not.toContain("password_hash");
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it("rejects missing/invalid invitations without an account", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token: "A".repeat(43), ...GOOD }));
    expect(res.status).toBe(410);
    expect(await w.store.getUserByEmail("ada@infaix.com")).toBeNull();
  });

  it("rejects expired invitations", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w, { ttlMs: 1000 });
    w.advance(2000);
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD }));
    expect(res.status).toBe(410);
  });

  it("rejects revoked invitations", async () => {
    const w = makeWorld();
    const { token, id } = await seedInvite(w);
    expect(await w.store.revokeInvitation(id, w.getNow())).toBe(true);
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD }));
    expect(res.status).toBe(410);
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

  it("rejects weak passwords and bad input without creating users", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token, email: "ada@infaix.com", password: "short", displayName: "Ada" }));
    expect(res.status).toBe(400);
    expect(await w.store.getUserByEmail("ada@infaix.com")).toBeNull();
  });

  it("defaults new accounts to ai_access=0 (never granted by registration)", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    const res = await handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD }));
    expect(res.status).toBe(201);
    expect((res.body as { user: { ai_access: boolean } }).user.ai_access).toBe(false);
    const row = await w.store.getUserByEmail("ada@infaix.com");
    expect(row?.ai_access).toBe(0);
  });

  it("is rate limited", async () => {
    const w = makeWorld({ RL_REGISTER_LIMIT: "2", RL_REGISTER_WINDOW: "3600" });
    const t = async () => {
      const { token } = await seedInvite(w);
      return handleRegister(w.ctx, post("/api/auth/register", { token, ...GOOD, email: `u${Math.random()}@x.com` }));
    };
    await t();
    await t();
    const third = await t();
    expect(third.status).toBe(429);
  });
});
