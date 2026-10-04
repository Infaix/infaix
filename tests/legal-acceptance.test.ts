import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRIVACY_VERSION, TERMS_VERSION } from "../src/lib/legal-versions";
import { handleRegister } from "../worker/auth/handlers";
import { makeWorld, ORIGIN, post } from "./helpers";

const PW = "Correct-Horse-99-Battery";
const base = { email: "ada@infaix.com", password: PW, displayName: "Ada" };

function code(body: unknown): string {
  return (body as { error: { code: string } }).error.code;
}

describe("server-side legal acknowledgement", () => {
  it("rejects a raw request that omits the acknowledgement field", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, new Request(`${ORIGIN}/api/auth/register`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(base),
    }));
    expect(res.status).toBe(400);
    expect(code(res.body)).toBe("LEGAL_ACK_REQUIRED");
    expect(await w.store.getUserByEmail(base.email)).toBeNull();
  });

  it("rejects a missing acknowledgement and creates nothing", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", { ...base, legal: null }));
    expect(res.status).toBe(400);
    expect(code(res.body)).toBe("LEGAL_ACK_REQUIRED");
    expect(await w.store.getUserByEmail(base.email)).toBeNull();
    expect(w.store.legalAcceptances).toHaveLength(0);
  });

  it("rejects a false acknowledgement", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", {
      ...base,
      legal: { accepted: false, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION },
    }));
    expect(res.status).toBe(400);
    expect(code(res.body)).toBe("LEGAL_ACK_REQUIRED");
    expect(await w.store.getUserByEmail(base.email)).toBeNull();
  });

  it("rejects a client-chosen policy version", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", {
      ...base,
      legal: { accepted: true, termsVersion: "terms-draft", privacyVersion: PRIVACY_VERSION },
    }));
    expect(res.status).toBe(400);
    expect(code(res.body)).toBe("LEGAL_ACK_REQUIRED");
    expect(await w.store.getUserByEmail(base.email)).toBeNull();
  });

  it("stores the server versions and does not subscribe or grant access", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", {
      ...base,
      role: "OWNER",
      ai_access: 1,
      newsletterSubscribed: true,
      legal: { accepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, source: "OWNER" },
    }));
    expect(res.status).toBe(201);
    const user = (res.body as { user: { id: string; role: string; ai_access: boolean } }).user;
    expect(user.role).toBe("USER");
    expect(user.ai_access).toBe(false);
    const row = await w.store.getUserById(user.id);
    expect(row?.ai_access).toBe(0);
    expect(await w.store.listProductGrantsForUser(user.id)).toHaveLength(0);
    expect(await w.store.getNewsletterByEmail(base.email)).toBeNull();
    const accepted = await w.store.listLegalAcceptancesForUser(user.id);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      source: "registration",
    });
    expect(accepted[0]?.accepted_at).toBe(w.getNow());
    expect(JSON.stringify(accepted[0])).not.toContain("127.0.0.1");
  });

  it("keeps the terms links outside the acceptance label", () => {
    const form = readFileSync("src/app/register/form.tsx", "utf8");
    const label = form.slice(form.indexOf('<label htmlFor="reg-terms">'), form.indexOf("</label>", form.indexOf("reg-terms")));
    expect(label).toContain("I accept the Terms of Use");
    expect(label).not.toContain("<Link");
    expect(form).toContain('href="/legal/terms"');
    expect(form).toContain('href="/legal/privacy"');
    const script = readFileSync("scripts/bootstrap-owner.mjs", "utf8");
    expect(script).toContain(TERMS_VERSION);
    expect(script).toContain(PRIVACY_VERSION);
  });
});
