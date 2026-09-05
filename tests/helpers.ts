// Shared harness for account-system tests: in-memory store, controllable
// clock, and request builders. No network, no Cloudflare dependencies.
import {
  handleLogin,
  handleRegister,
  handleVerifyEmail,
  type HandlerContext,
} from "../worker/auth/handlers";
import { OutboxMailer } from "../worker/auth/mailer";
import { MemoryStore } from "../worker/auth/memory";
import { newId, randomToken, sha256Hex } from "../worker/auth/crypto";
import type { D1Like, Env, Role } from "../worker/auth/types";

export const ORIGIN = "https://infaix.com";

export interface TestWorld {
  ctx: HandlerContext;
  store: MemoryStore;
  setNow: (t: number) => void;
  advance: (ms: number) => void;
  getNow: () => number;
}

export function makeWorld(envExtra: Partial<Env> = {}): TestWorld {
  const store = new MemoryStore();
  let now = 1_750_000_000_000;
  const env: Env = {
    INFAIX_DB: null as unknown as D1Like,
    SESSION_SECRET: "test-session-secret-min-32-chars!!",
    ENVIRONMENT: "test",
    APP_ORIGIN: ORIGIN,
    PBKDF2_ITERATIONS: "50000",
    ...envExtra,
  };
  const ctx: HandlerContext = {
    store,
    env,
    now: () => now,
    ip: "127.0.0.1",
    userAgent: "vitest",
    origin: ORIGIN,
    secure: true,
    mailer: new OutboxMailer(store),
  };
  return {
    ctx,
    store,
    setNow: (t: number) => {
      now = t;
    },
    advance: (ms: number) => {
      now += ms;
    },
    getNow: () => now,
  };
}

export function post(path: string, body: unknown, cookie?: string, origin = ORIGIN): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin,
  };
  if (cookie) headers.cookie = cookie;
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export function get(path: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request(`${ORIGIN}${path}`, { method: "GET", headers });
}

export function sessionCookieOf(headers: Record<string, string> | undefined): string | null {
  const set = headers?.["set-cookie"];
  if (!set) return null;
  return set.split(";")[0];
}

export async function seedInvite(
  w: TestWorld,
  opts: { email?: string; role?: Role; ttlMs?: number; status?: "PENDING" | "USED" | "REVOKED" | "EXPIRED" } = {}
): Promise<{ token: string; id: string }> {
  const token = randomToken();
  const now = w.getNow();
  const id = newId("inv");
  await w.store.insertInvitation({
    id,
    token_hash: await sha256Hex(token),
    status: opts.status ?? "PENDING",
    intended_email: opts.email ? opts.email.toLowerCase() : null,
    role: opts.role ?? "USER",
    inviter_user_id: null,
    created_at: now,
    expires_at: now + (opts.ttlMs ?? 72 * 60 * 60 * 1000),
    used_at: null,
    used_by_user_id: null,
    revoked_at: null,
    note: null,
  });
  return { token, id };
}

const PASSWORD = "Correct-Horse-99-Battery";

/** Full happy path: invite -> register -> verify email -> login. */
export async function registerVerifyLogin(
  w: TestWorld,
  opts: { email?: string; password?: string; displayName?: string } = {}
): Promise<{ userId: string; email: string; cookie: string }> {
  const email = opts.email ?? "ada@infaix.com";
  const password = opts.password ?? PASSWORD;
  const { token } = await seedInvite(w);
  const reg = await handleRegister(
    w.ctx,
    post("/api/auth/register", { token, email, password, displayName: opts.displayName ?? "Ada" })
  );
  if (reg.status !== 201) throw new Error("setup register failed: " + JSON.stringify(reg.body));
  const outbox = await w.store.latestOutbox(email.toLowerCase(), "email_verification");
  if (!outbox) throw new Error("setup: no verification outbox entry");
  const ver = await handleVerifyEmail(w.ctx, post("/api/auth/verify-email", { token: outbox.link_token }));
  if (ver.status !== 200) throw new Error("setup verify failed: " + JSON.stringify(ver.body));
  const login = await handleLogin(w.ctx, post("/api/auth/login", { email, password }));
  if (login.status !== 200) throw new Error("setup login failed: " + JSON.stringify(login.body));
  const cookie = sessionCookieOf(login.headers);
  if (!cookie) throw new Error("setup: no session cookie");
  const userId = ((login.body as { user: { id: string } }).user as { id: string }).id;
  return { userId, email, cookie };
}
