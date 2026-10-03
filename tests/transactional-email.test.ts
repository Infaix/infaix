import { describe, expect, it } from "vitest";
import {
  renderEmailChangedEmail,
  renderPasswordChangedEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
  renderWelcomeEmail,
} from "../worker/auth/email-templates";
import { handleChangePassword, handleRegister, handleVerifyEmail } from "../worker/auth/handlers";
import { ResendMailer } from "../worker/auth/mailer";
import { makeWorld, ORIGIN, post, registerVerifyLogin } from "./helpers";

const MARKETING = /unsubscribe from our newsletter|limited time|act now|early access offer/i;

describe("transactional email templates", () => {
  it("verification mail states expiry, one use, and identity without product access", () => {
    const link = `${ORIGIN}/verify-email?token=${"a".repeat(43)}`;
    const mail = renderVerificationEmail(link);
    expect(mail.subject).toBe("Verify your INFAIX account");
    expect(mail.text).toContain("24 hours");
    expect(mail.text).toContain(link);
    expect(mail.text).toContain("does not grant access to private products");
    expect(mail.html).toContain("Verify email");
    expect(mail.html).toContain("lang=\"en\"");
    expect(mail.text).not.toMatch(MARKETING);
    expect(mail.html).not.toMatch(MARKETING);
  });

  it("escapes hostile links in HTML and keeps a plain-text fallback", () => {
    const link = `https://infaix.com/verify-email?token=abc"><script>alert(1)</script>`;
    const mail = renderVerificationEmail(link);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain(link);
  });

  it("welcome, reset, password-changed, and email-changed notices stay non-promotional", () => {
    const welcome = renderWelcomeEmail(`${ORIGIN}/login`);
    const reset = renderPasswordResetEmail(`${ORIGIN}/reset-password?token=abc`);
    const changed = renderPasswordChangedEmail(`${ORIGIN}/forgot-password`);
    const moved = renderEmailChangedEmail("a***@example.com", `${ORIGIN}/forgot-password`);
    for (const mail of [welcome, reset, changed, moved]) {
      expect(mail.text.length).toBeGreaterThan(40);
      expect(mail.html).toContain("INFAIX");
      expect(mail.text).not.toMatch(MARKETING);
      expect(mail.html).not.toContain("<img");
    }
    expect(reset.text).toContain("1 hour");
    expect(changed.subject).toBe("Your INFAIX password was changed");
    expect(moved.subject).toBe("Your INFAIX email address was changed");
    expect(welcome.text).toContain("does not grant access to private products");
  });

  it("queues welcome and password-changed notices in the dev outbox", async () => {
    const w = makeWorld();
    await handleRegister(w.ctx, post("/api/auth/register", { email: "ada@infaix.com", password: "Correct-Horse-99-Battery", displayName: "Ada" }));
    const token = (await w.store.latestOutbox("ada@infaix.com", "email_verification"))?.link_token;
    expect(token).toBeTruthy();
    expect((await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token }))).status).toBe(200);
    expect(await w.store.latestOutbox("ada@infaix.com", "account_welcome")).not.toBeNull();

    const { cookie } = await registerVerifyLogin(w, { email: "bea@infaix.com" });
    const changed = await handleChangePassword(
      w.ctx,
      post("/api/auth/change-password", { currentPassword: "Correct-Horse-99-Battery", newPassword: "Brand-New-Password-77!" }, cookie)
    );
    expect(changed.status).toBe(200);
    expect(await w.store.latestOutbox("bea@infaix.com", "password_changed")).not.toBeNull();
  });

  it("sends rendered HTML and text through the provider without logging the token into the outbox", async () => {
    const w = makeWorld();
    const captured: { body: string | null } = { body: null };
    const mailer = new ResendMailer("re_test", "INFAIX <identity@infaix.com>", async (_url, init) => {
      captured.body = String(init.body);
      return new Response("{}", { status: 200 });
    });
    const link = `${ORIGIN}/verify-email?token=${"b".repeat(43)}`;
    await mailer.sendVerification("member@infaix.com", link, 0);
    const payload = JSON.parse(captured.body ?? "{}");
    expect(payload.subject).toBe("Verify your INFAIX account");
    expect(payload.text).toContain(link);
    expect(payload.html).toContain("24 hours");
    expect(await w.store.latestOutbox("member@infaix.com", "email_verification")).toBeNull();
  });
});
