import { describe, expect, it } from "vitest";
import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { handleApi } from "../worker/auth/router";
import { sha256Hex } from "../worker/auth/crypto";
import { signToken } from "../worker/auth/sessions";
import type { D1Like, D1Value, Env, SessionRow, UserRow } from "../worker/auth/types";
import { makeWorld, ORIGIN } from "./helpers";

const STUDY_ORIGIN = "https://study.infaix.com";
const TEST_PASSWORD_HASH = "test-password-hash-never-exported";

function routeDatabase(user: UserRow, session: SessionRow): D1Like {
  return {
    prepare(query: string) {
      let values: D1Value[] = [];
      const sql = query.replace(/\s+/g, " ").trim();
      return {
        bind(...bound: D1Value[]) { values = bound; return this; },
        async first<T>() {
          if (sql === "SELECT * FROM users WHERE id = ?") return (values[0] === user.id ? user : null) as T | null;
          if (sql === "SELECT * FROM sessions WHERE id = ?") return (values[0] === session.id ? session : null) as T | null;
          return null;
        },
        async all<T>() { return { results: [] as T[] }; },
        async run() {
          if (sql === "UPDATE sessions SET expires_at = ?, last_seen_at = ? WHERE id = ?" && values[2] === session.id) {
            session.expires_at = Number(values[0]);
            session.last_seen_at = Number(values[1]);
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  } as D1Like;
}

async function makeStudyFixture(envExtra: Partial<Env> = {}, status: UserRow["status"] = "ACTIVE") {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const privatePem = await exportPKCS8(privateKey);
  const env: Env = {
    ...makeWorld().ctx.env,
    INFAIX_DB: null as unknown as D1Like,
    STUDY_ORIGIN,
    STUDY_IDENTITY_AUDIENCE: "infaix-study",
    STUDY_IDENTITY_PRIVATE_KEY: privatePem,
    ...envExtra,
  };
  const user: UserRow = {
    id: "usr_study_route_test",
    email: "study-route@example.invalid",
    password_hash: TEST_PASSWORD_HASH,
    display_name: "Study Route",
    role: "USER",
    status,
    email_verified: 1,
    ai_access: 0,
    created_at: 1,
    updated_at: 1,
    last_login_at: 1,
  };
  const rawToken = "study-route-session-token-never-exported";
  const sessionId = await sha256Hex(rawToken);
  const now = Date.now();
  const session: SessionRow = {
    id: sessionId,
    user_id: user.id,
    created_at: now,
    expires_at: now + 60_000,
    last_seen_at: now,
    ip: null,
    user_agent: null,
  };
  env.INFAIX_DB = routeDatabase(user, session);
  const signedToken = await signToken(env, rawToken);
  if (!signedToken) throw new Error("test session signing failed");
  return { env, user, cookie: `infaix_session=${encodeURIComponent(signedToken)}`, privatePem, publicKey };
}

describe("GET /api/auth/study", () => {
  it("redirects an authenticated active Core user to Study with a Study-audience assertion", async () => {
    const fixture = await makeStudyFixture();
    const url = new URL("/api/auth/study", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    expect(response && !(response instanceof Response)).toBe(true);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(302);
    expect(response.headers?.["cache-control"]).toBe("no-store");
    const location = new URL(response.headers?.location ?? "");
    expect(location.origin).toBe(STUDY_ORIGIN);
    expect(location.pathname).toBe("/api/auth/core/callback");
    const assertion = location.searchParams.get("assertion");
    expect(assertion).toBeTruthy();
    const verified = await jwtVerify(assertion!, fixture.publicKey, {
      algorithms: ["RS256"],
      issuer: "infaix-core",
      audience: "infaix-study",
    });
    expect(verified.payload.sub).toBe(fixture.user.id);
    expect(typeof verified.payload.jti).toBe("string");
    const ttl = verified.payload.exp! - verified.payload.iat!;
    expect(ttl).toBeGreaterThanOrEqual(89);
    expect(ttl).toBeLessThanOrEqual(90);
    expect(assertion).not.toContain(fixture.privatePem);
    expect(assertion).not.toContain(TEST_PASSWORD_HASH);
  });

  it("binds the assertion to the Study audience so a Chat token cannot be reused", async () => {
    const fixture = await makeStudyFixture();
    const url = new URL("/api/auth/study", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    if (!response || response instanceof Response) return;
    const assertion = new URL(response.headers?.location ?? "").searchParams.get("assertion")!;
    // A Study verifier must reject a Chat-audience token, and vice versa.
    await expect(
      jwtVerify(assertion, fixture.publicKey, {
        algorithms: ["RS256"],
        issuer: "infaix-core",
        audience: "infaix-chat",
      })
    ).rejects.toThrow();
  });

  it("rejects an attacker-chosen return destination without issuing an assertion", async () => {
    const fixture = await makeStudyFixture();
    const url = new URL(
      `/api/auth/study?return_to=${encodeURIComponent("https://evil.example/steal")}`,
      ORIGIN
    );
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain("INVALID_REDIRECT");
    expect(JSON.stringify(response.body)).not.toContain("assertion");
  });

  it("does not issue an assertion without an authenticated Core session", async () => {
    const fixture = await makeStudyFixture();
    const url = new URL("/api/auth/study", ORIGIN);
    const response = await handleApi(new Request(url), fixture.env, url);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(302);
    const location = response.headers?.location ?? "";
    expect(location.startsWith("/login?returnTo=")).toBe(true);
    expect(location).not.toContain("assertion=");
  });

  it("does not issue an assertion to a disabled identity", async () => {
    const fixture = await makeStudyFixture({}, "DISABLED");
    const url = new URL("/api/auth/study", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    if (!response || response instanceof Response) return;
    // A disabled account is treated as unauthenticated: redirected to Core
    // login, never handed an assertion.
    expect(response.status).toBe(302);
    expect(response.headers?.location ?? "").toMatch(/^\/login\?returnTo=/);
    expect(response.headers?.location).not.toContain("assertion=");
  });

  it("fails closed when the Study origin is not configured", async () => {
    const fixture = await makeStudyFixture({ STUDY_ORIGIN: undefined });
    const url = new URL("/api/auth/study", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(503);
  });

  it("fails closed when the signing key is missing", async () => {
    const fixture = await makeStudyFixture({ STUDY_IDENTITY_PRIVATE_KEY: undefined });
    const url = new URL("/api/auth/study", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(503);
  });

  it("rejects a non-https Study origin configuration", async () => {
    const fixture = await makeStudyFixture({ STUDY_ORIGIN: "http://study.infaix.com" });
    const url = new URL("/api/auth/study", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(503);
  });
});
