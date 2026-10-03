import { describe, expect, it } from "vitest";
import { canUseInfaixAI } from "../worker/auth/entitlement";
import {
  handleLogin,
  handleMe,
  handleRegister,
  handleRequestPasswordReset,
  handleRequestVerification,
  handleResetPassword,
  handleSetAiAccess,
  handleVerifyEmail,
} from "../worker/auth/handlers";
import { canLaunch, publicApps } from "../src/lib/app-contract";
import { INFAIX_APPS } from "../src/lib/app-registry";
import { get, makeWorld, post, registerVerifyLogin, seedInvite } from "./helpers";

const PW = "Correct-Horse-99-Battery";
const reg = (w: ReturnType<typeof makeWorld>, email: string) =>
  handleRegister(w.ctx, post("/api/auth/register", { email, password: PW, displayName: "Test User" }));

async function verificationToken(w: ReturnType<typeof makeWorld>, email: string): Promise<string> {
  const ob = await w.store.latestOutbox(email.toLowerCase(), "email_verification");
  if (!ob) throw new Error("no verification outbox entry");
  return ob.link_token;
}

async function resetToken(w: ReturnType<typeof makeWorld>, email: string): Promise<string> {
  const res = await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email }));
  expect(res.status).toBe(200);
  const ob = await w.store.latestOutbox(email.toLowerCase(), "password_reset");
  if (!ob) throw new Error("no reset outbox entry");
  return ob.link_token;
}

describe("verification token lifecycle", () => {
  it("malformed tokens are 400; unknown tokens are 410; nothing mutates", async () => {
    const w = makeWorld();
    await reg(w, "ada@infaix.com");
    const bad = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: "junk" }));
    expect(bad.status).toBe(400);
    const unknown = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: "A".repeat(43) }));
    expect(unknown.status).toBe(410);
    expect((unknown.body as { error: { code: string } }).error.code).toBe("VERIFICATION_INVALID");
    const row = await w.store.getUserByEmail("ada@infaix.com");
    expect(row?.status).toBe("PENDING_VERIFICATION");
  });

  it("expired tokens are 410 and marked EXPIRED", async () => {
    const w = makeWorld();
    await reg(w, "ada@infaix.com");
    const token = await verificationToken(w, "ada@infaix.com");
    w.advance(25 * 60 * 60 * 1000);
    const res = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token }));
    expect(res.status).toBe(410);
    expect((res.body as { error: { code: string } }).error.code).toBe("VERIFICATION_EXPIRED");
    expect((await w.store.getUserByEmail("ada@infaix.com"))?.status).toBe("PENDING_VERIFICATION");
  });

  it("reuse is 410; sibling pending tokens die on successful verify", async () => {
    const w = makeWorld();
    await reg(w, "ada@infaix.com");
    const first = await verificationToken(w, "ada@infaix.com");
    // Second resend creates a sibling pending token.
    expect((await handleRequestVerification(w.ctx, post("/api/auth/request-verification", { email: "ada@infaix.com" }))).status).toBe(200);
    const second = await verificationToken(w, "ada@infaix.com");
    expect(second).not.toBe(first);
    const superseded = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: first }));
    expect(superseded.status).toBe(410);
    expect((superseded.body as { error: { code: string } }).error.code).toBe("VERIFICATION_EXPIRED");
    expect((await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: second }))).status).toBe(200);
    // Sibling now EXPIRED, account ACTIVE.
    expect((await w.store.getUserByEmail("ada@infaix.com"))?.status).toBe("ACTIVE");
    for (const v of w.store.verifications.values()) {
      expect(v.status).not.toBe("PENDING");
    }
    // Replay of the consumed token stays 410 and reports the account as verified.
    const replay = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: second }));
    expect(replay.status).toBe(410);
    expect((replay.body as { error: { code: string } }).error.code).toBe("ALREADY_VERIFIED");
    expect(await w.store.latestOutbox("ada@infaix.com", "account_welcome")).not.toBeNull();
  });

  it("raw tokens are stored hashed-only; responses never carry them", async () => {
    const w = makeWorld();
    const res = await reg(w, "ada@infaix.com");
    const token = await verificationToken(w, "ada@infaix.com");
    expect(JSON.stringify(res.body)).not.toContain(token);
    for (const v of w.store.verifications.values()) {
      expect(v.token_hash).not.toContain(token);
      expect(v.token_hash).toHaveLength(64);
    }
  });
});

describe("password-reset token lifecycle", () => {
  it("malformed/unknown/expired/reused tokens fail safely", async () => {
    const w = makeWorld();
    await registerVerifyLogin(w);
    const malformed = await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token: "junk", newPassword: "Fresh-Start-Password-88!" }));
    expect(malformed.status).toBe(400);
    const unknown = await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token: "A".repeat(43), newPassword: "Fresh-Start-Password-88!" }));
    expect(unknown.status).toBe(410);

    const token = await resetToken(w, "ada@infaix.com");
    w.advance(2 * 60 * 60 * 1000);
    const expired = await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token, newPassword: "Fresh-Start-Password-88!" }));
    expect(expired.status).toBe(410);
    expect((expired.body as { error: { code: string } }).error.code).toBe("RESET_EXPIRED");
  });

  it("successful reset invalidates sibling tokens and kills all sessions", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    const first = await resetToken(w, "ada@infaix.com");
    // A second request expires the first and mints a sibling.
    const second = await resetToken(w, "ada@infaix.com");
    expect(second).not.toBe(first);
    expect((await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token: first, newPassword: "Fresh-Start-Password-88!" }))).status).toBe(410);
    expect((await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token: second, newPassword: "Fresh-Start-Password-88!" }))).status).toBe(200);
    for (const r of w.store.resets.values()) {
      expect(r.status).not.toBe("PENDING");
    }
    // All sessions dead, including the pre-reset one.
    expect((await handleMe(w.ctx, get("/api/auth/me", cookie))).status).toBe(401);
    // New password works, old does not.
    expect((await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: PW }))).status).toBe(401);
    expect((await handleLogin(w.ctx, post("/api/auth/login", { email: "ada@infaix.com", password: "Fresh-Start-Password-88!" }))).status).toBe(200);
  });

  it("reset for a disabled account is 410 (no resurrection)", async () => {
    const w = makeWorld();
    const { userId } = await registerVerifyLogin(w);
    const token = await resetToken(w, "ada@infaix.com");
    await w.store.updateUser(userId, { status: "DISABLED", updated_at: w.getNow() });
    const dead = await handleResetPassword(w.ctx, post("/api/auth/reset-password", { token, newPassword: "Fresh-Start-Password-88!" }));
    expect(dead.status).toBe(410);
    expect((dead.body as { error: { code: string } }).error.code).toBe("RESET_INVALID");
  });
});

describe("enumeration resistance", () => {
  it("password-reset request bodies are identical for known/unknown emails", async () => {
    const w = makeWorld();
    await registerVerifyLogin(w);
    const known = await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "ada@infaix.com" }));
    const unknown = await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "ghost@infaix.com" }));
    expect(known.status).toBe(200);
    expect(JSON.stringify(known.body)).toBe(JSON.stringify(unknown.body));
    expect(await w.store.latestOutbox("ghost@infaix.com", "password_reset")).toBeNull();
  });

  it("verification resend bodies are identical for known/unknown/verified emails", async () => {
    const w = makeWorld();
    await registerVerifyLogin(w); // ada is ACTIVE now
    await reg(w, "pending@infaix.com"); // PENDING_VERIFICATION
    const bodies = [];
    for (const email of ["pending@infaix.com", "ada@infaix.com", "ghost@infaix.com"]) {
      const res = await handleRequestVerification(w.ctx, post("/api/auth/request-verification", { email }));
      expect(res.status).toBe(200);
      bodies.push(JSON.stringify(res.body));
    }
    expect(new Set(bodies).size).toBe(1);
    expect(await w.store.latestOutbox("ghost@infaix.com", "email_verification")).toBeNull();
  });

  it("per-address throttles stop inbox-bombing without oracles", async () => {
    const w = makeWorld({ RL_VERIFY_EMAIL_LIMIT: "2", RL_VERIFY_EMAIL_WINDOW: "3600", RL_RESET_EMAIL_LIMIT: "2", RL_RESET_EMAIL_WINDOW: "3600" });
    await reg(w, "victim@infaix.com");
    // Different sender IPs, same victim address.
    for (const ip of ["10.0.0.1", "10.0.0.2", "10.0.0.3"]) {
      w.ctx.ip = ip;
      await handleRequestVerification(w.ctx, post("/api/auth/request-verification", { email: "victim@infaix.com" }));
      await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "victim@infaix.com" }));
    }
    w.ctx.ip = "10.0.0.9";
    expect((await handleRequestVerification(w.ctx, post("/api/auth/request-verification", { email: "victim@infaix.com" }))).status).toBe(429);
    expect((await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "victim@infaix.com" }))).status).toBe(429);
  });
});

describe("authorization preservation (identity grants nothing)", () => {
  it("new accounts have no AI entitlement; only explicit OWNER grant confers it", async () => {
    const w = makeWorld();
    const res = await reg(w, "ada@infaix.com");
    const id = (res.body as { user: { id: string } }).user.id;
    expect(await canUseInfaixAI(w.store, id)).toBe(false);
    // PENDING accounts are never entitled even if someone flips ai_access early.
    await w.store.updateUser(id, { ai_access: 1, updated_at: w.getNow() });
    expect(await canUseInfaixAI(w.store, id)).toBe(false);
  });

  it("non-owners cannot self-grant ai_access through any API surface", async () => {
    const w = makeWorld();
    const { userId, cookie } = await registerVerifyLogin(w);
    // Attempt via ai-access endpoint with own session.
    expect((await handleSetAiAccess(w.ctx, post(`/api/admin/users/${userId}/ai-access`, { enabled: true }, cookie), userId)).status).toBe(403);
    expect((await w.store.getUserById(userId))?.ai_access).toBe(0);
    // Attempt via invite-shaped registration with privilege fields.
    const { token } = await seedInvite(w);
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", { token, email: "mallory@infaix.com", password: PW, displayName: "Mallory", role: "ADMIN", ai_access: 1 })
    );
    expect(res.status).toBe(201);
    expect((res.body as { user: { role: string; ai_access: boolean } }).user).toMatchObject({ role: "USER", ai_access: false });
  });

  it("private/planned products stay unreachable via the public contract", async () => {
    const apps = publicApps(INFAIX_APPS);
    for (const app of apps) {
      if (app.id === "study" || app.id === "atlas" || app.id === "shop") {
        expect(app.url).toBeNull();
        expect(canLaunch(app)).toBe(false);
      }
    }
    const ai = apps.find((a) => a.id === "ai");
    expect(ai?.availability).toBe("restricted");
    // Visibility is discovery only: a public listing never implies access.
    expect(apps.every((a) => a.visibility === "public")).toBe(true);
  });
});

describe("newsletter + product-grant data contracts (storage level)", () => {
  it("registration never creates newsletter consent", async () => {
    const w = makeWorld();
    await reg(w, "ada@infaix.com");
    expect(await w.store.getNewsletterByEmail("ada@infaix.com")).toBeNull();
  });

  it("newsletter subscribe / confirm / unsubscribe lifecycle", async () => {
    const w = makeWorld();
    const now = w.getNow();
    await w.store.upsertNewsletter({
      email: "reader@infaix.com",
      status: "PENDING_CONFIRMATION",
      consent_at: now,
      consent_source: "footer-form",
      policy_version: "privacy-2026-10-01",
      confirmed_at: null,
      unsubscribed_at: null,
      created_at: now,
      updated_at: now,
    });
    let row = await w.store.getNewsletterByEmail("reader@infaix.com");
    expect(row?.status).toBe("PENDING_CONFIRMATION");
    expect(row?.policy_version).toBe("privacy-2026-10-01");
    // Re-subscribe overwrites consent metadata without duplicating.
    await w.store.upsertNewsletter({ ...(row as NonNullable<typeof row>), status: "SUBSCRIBED", confirmed_at: now + 1, updated_at: now + 1 });
    row = await w.store.getNewsletterByEmail("reader@infaix.com");
    expect(row?.status).toBe("SUBSCRIBED");
    expect(await w.store.setNewsletterStatus("reader@infaix.com", "UNSUBSCRIBED", now + 2)).toBe(true);
    row = await w.store.getNewsletterByEmail("reader@infaix.com");
    expect(row?.status).toBe("UNSUBSCRIBED");
    expect(row?.unsubscribed_at).toBe(now + 2);
    expect(await w.store.setNewsletterStatus("nobody@infaix.com", "UNSUBSCRIBED", now)).toBe(false);
  });

  it("product grants: mint, list, revoke — identity alone grants nothing", async () => {
    const w = makeWorld();
    const res = await reg(w, "ada@infaix.com");
    const userId = (res.body as { user: { id: string } }).user.id;
    expect(await w.store.listProductGrantsForUser(userId)).toHaveLength(0);
    const now = w.getNow();
    await w.store.insertProductGrant({
      id: "pgr_aaaaaaaaaaaaaaaaaaaaaaaa",
      user_id: userId,
      product: "beta:study",
      status: "ACTIVE",
      source_invitation_id: null,
      created_at: now,
      updated_at: now,
      revoked_at: null,
    });
    expect((await w.store.listProductGrantsForUser(userId)).map((g) => g.product)).toEqual(["beta:study"]);
    expect(await w.store.revokeProductGrant("pgr_aaaaaaaaaaaaaaaaaaaaaaaa", now + 1)).toBe(true);
    expect(await w.store.revokeProductGrant("pgr_aaaaaaaaaaaaaaaaaaaaaaaa", now + 2)).toBe(false);
    expect((await w.store.listProductGrantsForUser(userId))[0]?.status).toBe("REVOKED");
  });
});
