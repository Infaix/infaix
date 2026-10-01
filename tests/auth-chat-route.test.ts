import { describe, expect, it } from "vitest";
import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { handleApi } from "../worker/auth/router";
import { sha256Hex } from "../worker/auth/crypto";
import { signToken } from "../worker/auth/sessions";
import type { D1Like, D1Value, Env, SessionRow, UserRow } from "../worker/auth/types";
import { makeWorld, ORIGIN } from "./helpers";

const CHAT_ORIGIN = "https://infaix-chat-dev.infaix.workers.dev";
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

async function makeRouteFixture(status: UserRow["status"] = "ACTIVE") {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const privatePem = await exportPKCS8(privateKey);
  const baseEnv = makeWorld().ctx.env;
  const env: Env = {
    ...baseEnv,
    INFAIX_DB: null as unknown as D1Like,
    CHAT_ORIGIN,
    CHAT_IDENTITY_AUDIENCE: "infaix-chat",
    CHAT_IDENTITY_PRIVATE_KEY: privatePem,
  };
  const user: UserRow = {
    id: "usr_route_test",
    email: "route-test@example.invalid",
    password_hash: TEST_PASSWORD_HASH,
    display_name: "Route Test",
    role: "USER",
    status,
    email_verified: 1,
    ai_access: 0,
    created_at: 1,
    updated_at: 1,
    last_login_at: 1,
  };
  const rawSessionToken = "route-test-session-token-never-exported";
  const sessionId = await sha256Hex(rawSessionToken);
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
  const signedToken = await signToken(env, rawSessionToken);
  if (!signedToken) throw new Error("test session signing failed");
  const cookie = `infaix_session=${encodeURIComponent(signedToken)}`;
  return { env, user, cookie, privatePem, publicKey };
}

describe("GET /api/auth/chat", () => {
  it("redirects an authenticated active Core user to the configured Chat callback with a short-lived RS256 assertion", async () => {
    const fixture = await makeRouteFixture();
    const url = new URL("/api/auth/chat", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    expect(response && !(response instanceof Response)).toBe(true);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(302);
    expect(response.headers?.["cache-control"]).toBe("no-store");
    const location = new URL(response.headers?.location ?? "");
    expect(location.origin).toBe(CHAT_ORIGIN);
    expect(location.pathname).toBe("/api/auth/core/callback");
    const assertion = location.searchParams.get("assertion");
    expect(assertion).toBeTruthy();
    const verified = await jwtVerify(assertion!, fixture.publicKey, {
      algorithms: ["RS256"],
      issuer: "infaix-core",
      audience: "infaix-chat",
    });
    expect(verified.payload.iss).toBe("infaix-core");
    expect(verified.payload.aud).toBe("infaix-chat");
    expect(verified.payload.sub).toBe(fixture.user.id);
    expect(typeof verified.payload.jti).toBe("string");
    expect(verified.payload.jti).not.toBe("");
    expect(typeof verified.payload.iat).toBe("number");
    expect(typeof verified.payload.exp).toBe("number");
    const ttl = verified.payload.exp! - verified.payload.iat!;
    expect(ttl).toBeGreaterThanOrEqual(89);
    expect(ttl).toBeLessThanOrEqual(90);
    expect(assertion).not.toContain(fixture.privatePem);
    expect(assertion).not.toContain(TEST_PASSWORD_HASH);
    expect(assertion).not.toContain(fixture.cookie);
  });

  it("does not issue an assertion without an authenticated Core session", async () => {
    const fixture = await makeRouteFixture();
    const url = new URL("/api/auth/chat", ORIGIN);
    const response = await handleApi(new Request(url), fixture.env, url);
    expect(response && !(response instanceof Response)).toBe(true);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(response.headers?.location).toBeUndefined();
  });

  it("does not issue an assertion to an authenticated but disabled identity", async () => {
    const fixture = await makeRouteFixture("DISABLED");
    const url = new URL("/api/auth/chat", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    expect(response && !(response instanceof Response)).toBe(true);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(response.headers?.location).toBeUndefined();
  });

  it("rejects attacker destinations with an authenticated session and never emits an assertion there", async () => {
    for (const destination of [
      "https://evil.example",
      "https://infaix-chat-dev.infaix.workers.dev.evil.example",
      "https://evil.example/infaix-chat-dev.infaix.workers.dev",
      "http://infaix-chat-dev.infaix.workers.dev",
      "https://infaix-chat-dev.infaix.workers.dev@evil.example",
      "//evil.example",
      "https://[",
      "/messages",
      "/spaces/example",
      "\\\\evil.example",
    ]) {
      const fixture = await makeRouteFixture();
      const url = new URL("/api/auth/chat", ORIGIN);
      url.searchParams.set("return_to", destination);
      const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
      expect(response && !(response instanceof Response)).toBe(true);
      if (!response || response instanceof Response) continue;
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: "INVALID_REDIRECT" } });
      expect(response.headers?.location).toBeUndefined();
    }
  });

  it.each([
    ["missing", undefined],
    ["malformed", "not a URL"],
    ["non-HTTPS", "http://infaix-chat-dev.infaix.workers.dev"],
    ["path-bearing", `${CHAT_ORIGIN}/unexpected`],
  ])("fails closed when CHAT_ORIGIN configuration is %s", async (_label, configuredOrigin) => {
    const fixture = await makeRouteFixture();
    if (configuredOrigin === undefined) delete fixture.env.CHAT_ORIGIN;
    else fixture.env.CHAT_ORIGIN = configuredOrigin;
    const url = new URL("/api/auth/chat", ORIGIN);
    const response = await handleApi(new Request(url, { headers: { cookie: fixture.cookie } }), fixture.env, url);
    expect(response && !(response instanceof Response)).toBe(true);
    if (!response || response instanceof Response) return;
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { code: "AUTH_UNAVAILABLE" } });
    expect(response.headers?.location).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("not a URL");
  });
});
