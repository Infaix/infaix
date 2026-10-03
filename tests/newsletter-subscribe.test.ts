import { describe, expect, it } from "vitest";
import { handleNewsletterSubscribe, handleNewsletterWithdraw, handleRegister } from "../worker/auth/handlers";
import { NEWSLETTER_POLICY_VERSION } from "../src/lib/newsletter-consent";
import { makeWorld, post, registerVerifyLogin } from "./helpers";

const PW = "Correct-Horse-99-Battery";

function subscribe(email: string, extra: Record<string, unknown> = {}) {
  return {
    email,
    source: "registration",
    policyVersion: NEWSLETTER_POLICY_VERSION,
    consent: true,
    ...extra,
  };
}

describe("newsletter consent hook", () => {
  it("registration still creates no subscription", async () => {
    const w = makeWorld();
    expect((await handleRegister(w.ctx, post("/api/auth/register", { email: "ada@infaix.com", password: PW, displayName: "Ada" }))).status).toBe(201);
    expect(await w.store.getNewsletterByEmail("ada@infaix.com")).toBeNull();
  });

  it("records pending confirmation and never subscribes from the checkbox", async () => {
    const w = makeWorld();
    const res = await handleNewsletterSubscribe(w.ctx, post("/api/newsletter/subscribe", subscribe("reader@infaix.com")));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toBe(JSON.stringify({ ok: true }));
    const row = await w.store.getNewsletterByEmail("reader@infaix.com");
    expect(row?.status).toBe("PENDING_CONFIRMATION");
    expect(row?.confirmed_at).toBeNull();
    expect(row?.policy_version).toBe(NEWSLETTER_POLICY_VERSION);
    expect(row?.consent_source).toBe("registration");
    expect(await w.store.getUserByEmail("reader@infaix.com")).toBeNull();
  });

  it("refuses a missing or false consent flag without writing a row", async () => {
    const w = makeWorld();
    const missing = await handleNewsletterSubscribe(w.ctx, post("/api/newsletter/subscribe", subscribe("reader@infaix.com", { consent: false })));
    expect(missing.status).toBe(400);
    expect(await w.store.getNewsletterByEmail("reader@infaix.com")).toBeNull();
  });

  it("uses the same response for addresses with and without accounts", async () => {
    const w = makeWorld();
    await handleRegister(w.ctx, post("/api/auth/register", { email: "ada@infaix.com", password: PW, displayName: "Ada" }));
    const known = await handleNewsletterSubscribe(w.ctx, post("/api/newsletter/subscribe", subscribe("ada@infaix.com")));
    const unknown = await handleNewsletterSubscribe(w.ctx, post("/api/newsletter/subscribe", subscribe("ghost@infaix.com")));
    expect(known.status).toBe(200);
    expect(JSON.stringify(known.body)).toBe(JSON.stringify(unknown.body));
  });

  it("keeps an existing subscription subscribed when consent is refreshed", async () => {
    const w = makeWorld();
    const now = w.getNow();
    await w.store.upsertNewsletter({
      email: "reader@infaix.com",
      status: "SUBSCRIBED",
      consent_at: now,
      consent_source: "registration",
      policy_version: NEWSLETTER_POLICY_VERSION,
      confirmed_at: now,
      unsubscribed_at: null,
      created_at: now,
      updated_at: now,
    });
    expect((await handleNewsletterSubscribe(w.ctx, post("/api/newsletter/subscribe", subscribe("reader@infaix.com", { source: "account-settings" })))).status).toBe(200);
    const row = await w.store.getNewsletterByEmail("reader@infaix.com");
    expect(row?.status).toBe("SUBSCRIBED");
    expect(row?.confirmed_at).toBe(now);
  });

  it("lets the signed-in account withdraw without creating a row for someone who never opted in", async () => {
    const w = makeWorld();
    const { cookie } = await registerVerifyLogin(w);
    await handleNewsletterSubscribe(w.ctx, post("/api/newsletter/subscribe", subscribe("ada@infaix.com", { source: "account-settings" })));
    const withdrawn = await handleNewsletterWithdraw(w.ctx, post("/api/newsletter/withdraw", {}, cookie));
    expect(withdrawn.status).toBe(200);
    expect((await w.store.getNewsletterByEmail("ada@infaix.com"))?.status).toBe("UNSUBSCRIBED");

    const { cookie: other } = await registerVerifyLogin(w, { email: "bea@infaix.com" });
    const none = await handleNewsletterWithdraw(w.ctx, post("/api/newsletter/withdraw", {}, other));
    expect(none.status).toBe(200);
    expect(await w.store.getNewsletterByEmail("bea@infaix.com")).toBeNull();
  });
});
