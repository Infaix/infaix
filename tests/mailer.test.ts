import { describe, expect, it } from "vitest";
import { handleCreateInvite, handleRegister, handleRequestPasswordReset, handleRequestVerification } from "../worker/auth/handlers";
import { mailerFor } from "../worker/auth/mailer";
import type { Env } from "../worker/auth/types";
import { makeWorld, ORIGIN, post, registerVerifyLogin, seedInvite } from "./helpers";

const PROD_MAIL: Partial<Env> = {
  ENVIRONMENT: "production",
  EMAIL_PROVIDER: "resend",
  EMAIL_FROM: "INFAIX <identity@infaix.com>",
  RESEND_API_KEY: "re_test_transactional_provider_key",
};

function adminInviteRequest(body: unknown): Request {
  return new Request(`${ORIGIN}/api/admin/invites`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-admin-token": "bootstrap-token-for-tests" },
    body: JSON.stringify(body),
  });
}

describe("transactional production mail", () => {
  it("uses the explicitly configured provider and sends the verification link only to it", async () => {
    const w = makeWorld({ ...PROD_MAIL });
    let request: { url: string; init: RequestInit } | null = null;
    w.ctx.mailer = mailerFor(w.store, w.ctx.env, async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    });
    const { token } = await seedInvite(w, { email: "member@infaix.com" });
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", { token, email: "member@infaix.com", password: "Correct-Horse-99-Battery", displayName: "Member" })
    );

    expect(res.status).toBe(201);
    expect(request?.url).toBe("https://api.resend.com/emails");
    expect(request?.init.method).toBe("POST");
    expect(request?.init.headers).toMatchObject({ authorization: "Bearer re_test_transactional_provider_key" });
    const payload = JSON.parse(String(request?.init.body));
    expect(payload.to).toEqual(["member@infaix.com"]);
    expect(payload.text).toContain("https://infaix.com/verify-email?token=");
    expect(JSON.stringify(res.body)).not.toContain("verify-email?token=");
    expect(await w.store.latestOutbox("member@infaix.com", "email_verification")).toBeNull();
  });

  it("fails safely before claiming an invite when production delivery is not configured", async () => {
    const w = makeWorld({ ENVIRONMENT: "production" });
    const { token, id } = await seedInvite(w, { email: "member@infaix.com" });
    const res = await handleRegister(
      w.ctx,
      post("/api/auth/register", { token, email: "member@infaix.com", password: "Correct-Horse-99-Battery", displayName: "Member" })
    );

    expect(res.status).toBe(503);
    expect((res.body as { error: { code: string } }).error.code).toBe("EMAIL_UNAVAILABLE");
    expect(await w.store.getUserByEmail("member@infaix.com")).toBeNull();
    expect(w.store.invitations.get(id)?.status).toBe("PENDING");
  });

  it("refuses an OWNER bootstrap invite before creating it when production delivery is missing", async () => {
    const w = makeWorld({ ENVIRONMENT: "production", ADMIN_BOOTSTRAP_TOKEN: "bootstrap-token-for-tests" });
    const res = await handleCreateInvite(w.ctx, adminInviteRequest({ intendedEmail: "owner@infaix.com", role: "OWNER" }));

    expect(res.status).toBe(503);
    expect((res.body as { error: { code: string } }).error.code).toBe("EMAIL_UNAVAILABLE");
    expect(w.store.invitations.size).toBe(0);
  });

  it("documents the bootstrap-token preflight: existing email + USER role returns 409 without minting", async () => {
    // Intended operator-only signal (bootstrap token holder only; rotate the
    // token after use). No account is created, modified, or enumerated to
    // any other caller: unauthenticated and session callers never reach it.
    const w = makeWorld({ ADMIN_BOOTSTRAP_TOKEN: "bootstrap-token-for-tests" });
    await registerVerifyLogin(w, { email: "ada@infaix.com" });
    const before = w.store.invitations.size;
    const res = await handleCreateInvite(w.ctx, adminInviteRequest({ intendedEmail: "ada@infaix.com", role: "USER" }));

    expect(res.status).toBe(409);
    expect((res.body as { error: { code: string } }).error.code).toBe("ACCOUNT_EXISTS");
    expect(w.store.invitations.size).toBe(before);
  });

  it("password-reset requests fail uniformly without delivery: no rows, no oracle", async () => {
    const w = makeWorld({ ...PROD_MAIL });
    await registerVerifyLogin(w, { email: "ada@infaix.com" });
    // Simulate production with delivery unconfigured, wired exactly as the
    // router wires it (mailerFor over the live env).
    w.ctx.env = { ...w.ctx.env, EMAIL_PROVIDER: undefined, EMAIL_FROM: undefined, RESEND_API_KEY: undefined };
    w.ctx.mailer = mailerFor(w.store, w.ctx.env);
    const resetsBefore = w.store.resets.size;

    const existing = await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "ada@infaix.com" }));
    const unknown = await handleRequestPasswordReset(w.ctx, post("/api/auth/request-password-reset", { email: "ghost@infaix.com" }));

    for (const res of [existing, unknown]) {
      expect(res.status).toBe(503);
      expect((res.body as { error: { code: string } }).error.code).toBe("EMAIL_UNAVAILABLE");
    }
    expect(existing.status).toBe(unknown.status);
    expect(JSON.stringify(existing.body)).toBe(JSON.stringify(unknown.body));
    expect(w.store.resets.size).toBe(resetsBefore);
  });

  it("verification requests fail uniformly without delivery: no rows, no oracle", async () => {
    const w = makeWorld({ ...PROD_MAIL });
    const { token } = await seedInvite(w);
    const reg = await handleRegister(
      w.ctx,
      post("/api/auth/register", { token, email: "pending@infaix.com", password: "Correct-Horse-99-Battery", displayName: "Pending" })
    );
    expect(reg.status).toBe(201);
    // Simulate production with delivery unconfigured, wired exactly as the
    // router wires it (mailerFor over the live env).
    w.ctx.env = { ...w.ctx.env, EMAIL_PROVIDER: undefined, EMAIL_FROM: undefined, RESEND_API_KEY: undefined };
    w.ctx.mailer = mailerFor(w.store, w.ctx.env);
    const verificationsBefore = w.store.verifications.size;

    const existing = await handleRequestVerification(w.ctx, post("/api/auth/request-verification", { email: "pending@infaix.com" }));
    const unknown = await handleRequestVerification(w.ctx, post("/api/auth/request-verification", { email: "ghost@infaix.com" }));

    for (const res of [existing, unknown]) {
      expect(res.status).toBe(503);
      expect((res.body as { error: { code: string } }).error.code).toBe("EMAIL_UNAVAILABLE");
    }
    expect(existing.status).toBe(unknown.status);
    expect(JSON.stringify(existing.body)).toBe(JSON.stringify(unknown.body));
    expect(w.store.verifications.size).toBe(verificationsBefore);
  });
});
