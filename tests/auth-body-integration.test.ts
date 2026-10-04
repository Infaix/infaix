import { describe, expect, it, vi } from "vitest";
import * as authHandlers from "../worker/auth/handlers";
import { handleLogin, handleNewsletterSubscribe, handleRegister, handleRequestPasswordReset } from "../worker/auth/handlers";
import worker from "../worker/index";
import { NEWSLETTER_POLICY_VERSION } from "../src/lib/newsletter-consent";
import { makeWorld, ORIGIN, post, registerVerifyLogin, seedInvite } from "./helpers";
import { sqliteD1 } from "./sqlite-d1";

describe("auth body boundary", () => {
  it("rejects an oversized registration before account or mail creation", async () => {
    const w = makeWorld();
    const req = post("/api/auth/register", {
      email: "body-test@infaix.com", displayName: "Body Test",
      password: "Correct-Horse-99-Battery", padding: "x".repeat(16_384),
    });
    const result = await handleRegister(w.ctx, req);
    expect(result.status).toBe(413);
    expect(await w.store.getUserByEmail("body-test@infaix.com")).toBeNull();
    expect(await w.store.latestOutbox("body-test@infaix.com", "email_verification")).toBeNull();
    expect(w.store.legalAcceptances).toHaveLength(0);
    expect(w.store.verifications.size).toBe(0);
  });

  it("returns 415 for a non-JSON login rather than processing credentials", async () => {
    const w = makeWorld();
    const req = new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "text/plain" },
      body: JSON.stringify({ email: "body-test@infaix.com", password: "submitted-secret" }),
    });
    const result = await handleLogin(w.ctx, req);
    expect(result.status).toBe(415);
    expect(JSON.stringify(result.body)).not.toContain("submitted-secret");
    expect(JSON.stringify(result.body)).not.toContain("body-test@infaix.com");
  });

  it("returns 400 for malformed recovery JSON, not a misleading success", async () => {
    const w = makeWorld();
    const req = new Request(`${ORIGIN}/api/auth/request-password-reset`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" },
      body: '{"email":"private-email@infaix.com"',
    });
    const result = await handleRequestPasswordReset(w.ctx, req);
    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).not.toContain("private-email");
  });

  it("does not consume an invitation when rejecting an oversized registration", async () => {
    const w = makeWorld();
    const invite = await seedInvite(w);
    const result = await handleRegister(w.ctx, post("/api/auth/register", {
      token: invite.token, email: "invite-test@infaix.com", displayName: "Body Test",
      password: "Correct-Horse-99-Battery", padding: "x".repeat(16_384),
    }));
    expect(result.status).toBe(413);
    expect(w.store.invitations.get(invite.id)?.status).toBe("PENDING");
    expect(w.store.users.size).toBe(0);
    expect(w.store.verifications.size).toBe(0);
    expect(w.store.legalAcceptances).toHaveLength(0);
    expect(w.store.outbox).toHaveLength(0);
  });

  it("rejects oversized login before password derivation or account lookup", async () => {
    const w = makeWorld();
    const derive = vi.spyOn(crypto.subtle, "deriveBits");
    const lookup = vi.spyOn(w.store, "getUserByEmail");
    try {
      const result = await handleLogin(w.ctx, post("/api/auth/login", {
        email: "body-test@infaix.com", password: "secret" + "x".repeat(16_384),
      }));
      expect(result.status).toBe(413);
      expect(derive).not.toHaveBeenCalled();
      expect(lookup).not.toHaveBeenCalled();
      expect(w.store.sessions.size).toBe(0);
    } finally {
      derive.mockRestore();
      lookup.mockRestore();
    }
  });

  it("does not impose the auth media/16KiB contract on newsletter requests", async () => {
    const w = makeWorld();
    const req = post("/api/newsletter/subscribe", {
      email: "newsletter-test@infaix.com", source: "registration", consent: true,
      policyVersion: NEWSLETTER_POLICY_VERSION, padding: "x".repeat(17_000),
    });
    req.headers.set("content-type", "text/plain");
    expect((await handleNewsletterSubscribe(w.ctx, req)).status).toBe(200);
    expect((await w.store.getNewsletterByEmail("newsletter-test@infaix.com"))?.status).toBe("PENDING_CONFIRMATION");
  });
});

describe("all auth JSON routes use the bounded reader", () => {
  const routes: Record<string, (ctx: authHandlers.HandlerContext, req: Request, id: string) => Promise<authHandlers.HandlerResult>> = {
    "/api/auth/register": authHandlers.handleRegister,
    "/api/auth/login": authHandlers.handleLogin,
    "/api/auth/change-password": authHandlers.handleChangePassword,
    "/api/auth/profile": authHandlers.handleUpdateProfile,
    "/api/auth/request-password-reset": authHandlers.handleRequestPasswordReset,
    "/api/auth/reset-password": authHandlers.handleResetPassword,
    "/api/auth/request-verification": authHandlers.handleRequestVerification,
    "/api/auth/verify-email": authHandlers.handleVerifyEmail,
    "/api/admin/invites": authHandlers.handleCreateInvite,
    "/api/admin/users/:id/ai-access": authHandlers.handleSetAiAccess,
  };
  for (const [route, handler] of Object.entries(routes)) {
    it.each([
      { label: "oversized", body: JSON.stringify({ padding: "x".repeat(16_384) }), media: "application/json", status: 413, code: "BODY_TOO_LARGE" },
      { label: "unsupported media", body: "{}", media: "text/plain", status: 415, code: "UNSUPPORTED_MEDIA_TYPE" },
      { label: "non-object JSON", body: "null", media: "application/json", status: 400, code: "INVALID_BODY" },
    ])(`${route} rejects $label before mutation`, async ({ body, media, status, code }) => {
      const w = makeWorld();
      const { cookie, userId } = await registerVerifyLogin(w);
      await w.store.updateUser(userId, { role: "OWNER", updated_at: w.getNow() });
      const path = route.replace(":id", userId);
      const req = new Request(`${ORIGIN}${path}`, {
        method: "POST", headers: { origin: ORIGIN, cookie, "content-type": media }, body,
      });
      const before = JSON.stringify({
        users: [...w.store.users], invitations: [...w.store.invitations],
        sessions: [...w.store.sessions], verifications: [...w.store.verifications],
        resets: [...w.store.resets], legal: w.store.legalAcceptances, outbox: w.store.outbox,
      });
      const result = await handler(w.ctx, req, userId);
      expect(result).toMatchObject({ status, body: { error: { code, message: expect.any(String) } } });
      expect(JSON.stringify({
        users: [...w.store.users], invitations: [...w.store.invitations],
        sessions: [...w.store.sessions], verifications: [...w.store.verifications],
        resets: [...w.store.resets], legal: w.store.legalAcceptances, outbox: w.store.outbox,
      })).toBe(before);
    });
  }
});

describe("Worker boundary and telemetry", () => {
  it.each([
    { body: "{bad-private-password", media: "application/json", status: 400, code: "INVALID_BODY" },
    { body: JSON.stringify({ password: "private-password", padding: "x".repeat(16_384) }), media: "application/json", status: 413, code: "BODY_TOO_LARGE" },
    { body: "private-password", media: "text/plain", status: 415, code: "UNSUPPORTED_MEDIA_TYPE" },
  ])("preserves $status at the real Worker boundary without sensitive logs", async ({ body, media, status, code }) => {
    const sql = sqliteD1(["0001_init.sql", "0002_ai_access.sql", "0003_conversations.sql", "0004_public_identity.sql", "0005_legal_acceptance.sql"]);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const req = new Request(`${ORIGIN}/api/auth/register?token=private-token`, {
        method: "POST", headers: { origin: ORIGIN, "content-type": media, cookie: "private-cookie" }, body,
      });
      const res = await worker.fetch(req, makeWorld({ INFAIX_DB: sql.binding }).ctx.env, { waitUntil() {} });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: { code, message: expect.any(String) } });
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      const entries = log.mock.calls.flat().filter((entry): entry is string => typeof entry === "string");
      expect(entries.map((entry) => JSON.parse(entry))).toContainEqual(expect.objectContaining({
        event: "core_request", route: "/api/auth/register", status, error_code: "REQUEST_REJECTED",
      }));
      for (const secret of ["private-password", "private-cookie", "private-token"]) {
        expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
        expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
      }
      expect(errorLog).not.toHaveBeenCalled();
      expect(sql.db.prepare("SELECT COUNT(*) AS n FROM users").get()).toMatchObject({ n: 0 });
      expect(sql.db.prepare("SELECT COUNT(*) AS n FROM legal_acceptances").get()).toMatchObject({ n: 0 });
      expect(sql.db.prepare("SELECT COUNT(*) AS n FROM email_verifications").get()).toMatchObject({ n: 0 });
    } finally {
      log.mockRestore();
      errorLog.mockRestore();
      sql.db.close();
    }
  });
});
