// Auth API handlers. Pure functions of (ctx, request) — no framework,
// no globals — so they run in the Cloudflare Worker and under vitest.
// Every handler: validate input -> rate limit -> authorize -> mutate ->
// audit. Error messages never reveal account existence or secrets.
import { audit } from "./audit";
import { hashPassword, newId, randomToken, sha256Hex, verifyPassword } from "./crypto";
import { flowLink, type Mailer } from "./mailer";
import { checkRateLimit, limitFromEnv } from "./ratelimit";
import { buildClearCookie, createSession, verifySession } from "./sessions";
import type { Store } from "./store";
import {
  toPublicUser,
  type ApiError,
  type Env,
  type PublicUser,
  type Role,
  type UserRow,
} from "./types";
import { checkDisplayName, checkPassword, checkToken, isRecord, normalizeEmail } from "./validation";

export interface HandlerContext {
  store: Store;
  env: Env;
  now: () => number;
  ip: string | null;
  userAgent: string | null;
  origin: string;
  secure: boolean;
  mailer: Mailer;
}

export interface HandlerResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): HandlerResult => ({
  status,
  body,
  headers: { "content-type": "application/json; charset=utf-8", ...headers },
});

const err = (code: string, message: string, status: number): HandlerResult =>
  json({ error: { code, message } } satisfies ApiError, status);

// Well-formed dummy hash (password unknown) so unknown-email logins cost
// the same PBKDF2 work as real ones — no timing oracle for enumeration.
const DUMMY_HASH =
  "pbkdf2-sha256$210000$u3V4bXl6c3V4bXl6c3V4bXl6c3U$u3V4bXl6c3V4bXl6c3V4bXl6c3V4bXl6c3V4bXl6c3U";

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    const v: unknown = JSON.parse(text);
    return isRecord(v) ? v : null;
  } catch {
    return null;
  }
}

/** Same-origin check for cookie-authenticated POSTs (CSRF layer). */
function sameOrigin(req: Request, origin: string): boolean {
  const o = req.headers.get("origin");
  if (o) return o === origin;
  const r = req.headers.get("referer");
  if (r) return r.startsWith(origin + "/") || r === origin;
  return true;
}

// ---------------------------------------------------------------- register

export async function handleRegister(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const rl = limitFromEnv(ctx.env, "RL_REGISTER_LIMIT", "RL_REGISTER_WINDOW", 10, 3600);
  const gate = await checkRateLimit(ctx.store, `register:${ctx.ip ?? "unknown"}`, rl, ctx.now());
  if (!gate.allowed) return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(gate.retryAfterSec) });

  const body = await readJson(req);
  const token = body ? checkToken(body.token) : null;
  const email = body ? normalizeEmail(body.email) : null;
  const displayName = body ? checkDisplayName(body.displayName) : null;
  const pw = body ? checkPassword(body.password) : { ok: false, message: "Password is required." };
  const password = body && typeof body.password === "string" ? body.password : null;
  if (!token || !email || !displayName || !pw.ok || !password) {
    return err("INVALID_INPUT", !token ? "Invalid or missing invitation." : !email ? "Enter a valid email address." : !displayName ? "Enter a valid display name (1-60 characters)." : (pw.message ?? "Invalid password."), 400);
  }

  await ctx.store.expireInvitations(ctx.now());
  const inv = await ctx.store.getInvitationByTokenHash(await sha256Hex(token));
  if (!inv || inv.status !== "PENDING" || inv.expires_at <= ctx.now()) {
    return err("INVITATION_INVALID", "This invitation is invalid, expired, or already used.", 410);
  }
  if (inv.intended_email && inv.intended_email !== email) {
    return err("INVITATION_INVALID", "This invitation is invalid, expired, or already used.", 410);
  }
  if (await ctx.store.getUserByEmail(email)) {
    // Neutral: do not reveal the address is taken via a distinct path.
    return err("INVITATION_INVALID", "This invitation is invalid, expired, or already used.", 410);
  }

  const now = ctx.now();
  const user: UserRow = {
    id: newId("usr"),
    email,
    password_hash: await hashPassword(password, ctx.env.PBKDF2_ITERATIONS),
    display_name: displayName,
    role: inv.role,
    status: "PENDING_VERIFICATION",
    email_verified: 0,
    created_at: now,
    updated_at: now,
    last_login_at: null,
  };
  try {
    await ctx.store.insertUser(user);
  } catch {
    return err("INVITATION_INVALID", "This invitation is invalid, expired, or already used.", 410);
  }
  const claimed = await ctx.store.claimInvitation(inv.id, user.id, now);
  if (!claimed) {
    // Lost a race (or double submit): roll back the orphaned user row is
    // impossible without delete; instead disable it — no login possible.
    await ctx.store.updateUser(user.id, { status: "DISABLED", updated_at: now });
    return err("INVITATION_INVALID", "This invitation is invalid, expired, or already used.", 410);
  }

  // Issue verification token (24h). Login stays blocked until verified.
  const vToken = randomToken();
  await ctx.store.insertVerification({
    id: newId("evf"),
    user_id: user.id,
    token_hash: await sha256Hex(vToken),
    status: "PENDING",
    created_at: now,
    expires_at: now + 24 * 60 * 60 * 1000,
    used_at: null,
  });
  await ctx.mailer.sendVerification(email, flowLink(ctx.origin, "/verify-email", vToken), now);

  await audit(ctx.store, "INVITATION_USED", { target: user.id, ip: ctx.ip, detail: `invite:${inv.id}`, now });
  await audit(ctx.store, "ACCOUNT_CREATED", { target: user.id, ip: ctx.ip, detail: `role:${user.role}`, now });
  return json({ user: toPublicUser({ ...user }) satisfies PublicUser }, 201);
}

// ---------------------------------------------------------------- login

export async function handleLogin(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const rl = limitFromEnv(ctx.env, "RL_LOGIN_LIMIT", "RL_LOGIN_WINDOW", 10, 600);
  const ipGate = await checkRateLimit(ctx.store, `login:ip:${ctx.ip ?? "unknown"}`, rl, ctx.now());
  if (!ipGate.allowed) {
    return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(ipGate.retryAfterSec) });
  }

  const body = await readJson(req);
  const email = body ? normalizeEmail(body.email) : null;
  const password = typeof body?.password === "string" ? body.password : null;
  if (!email || !password) return err("INVALID_CREDENTIALS", "Invalid email or password.", 401);

  const emailGate = await checkRateLimit(ctx.store, `login:email:${email}`, { limit: rl.limit * 2, windowSec: rl.windowSec }, ctx.now());
  if (!emailGate.allowed) {
    return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(emailGate.retryAfterSec) });
  }

  const user = await ctx.store.getUserByEmail(email);
  const hash = user ? user.password_hash : DUMMY_HASH;
  const okPass = await verifyPassword(password, hash);
  const now = ctx.now();
  if (!user || !okPass) {
    await audit(ctx.store, "LOGIN_FAILURE", { target: user ? user.id : null, ip: ctx.ip, detail: "bad-credentials", now });
    return err("INVALID_CREDENTIALS", "Invalid email or password.", 401);
  }
  if (user.status === "DISABLED") {
    await audit(ctx.store, "LOGIN_FAILURE", { target: user.id, ip: ctx.ip, detail: "disabled", now });
    return err("ACCOUNT_DISABLED", "This account is disabled.", 403);
  }
  if (user.status !== "ACTIVE") {
    await audit(ctx.store, "LOGIN_FAILURE", { target: user.id, ip: ctx.ip, detail: "unverified", now });
    return err("EMAIL_NOT_VERIFIED", "Verify your email address before logging in.", 403);
  }

  const session = await createSession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    user.id
  );
  if (!session) return err("AUTH_UNAVAILABLE", "Authentication is temporarily unavailable.", 503);
  await ctx.store.updateUser(user.id, { updated_at: now, last_login_at: now });
  await audit(ctx.store, "LOGIN_SUCCESS", { actor: user.id, target: user.id, ip: ctx.ip, now });
  const refreshed = (await ctx.store.getUserById(user.id)) ?? user;
  return json({ user: toPublicUser(refreshed) }, 200, { "set-cookie": session.setCookie });
}

// ---------------------------------------------------------------- logout

export async function handleLogout(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  // Always clear the cookie; invalidate server-side when resolvable.
  const authed = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (authed) {
    await ctx.store.deleteSession(authed.sessionId);
    await audit(ctx.store, "LOGOUT", { actor: authed.user.id, target: authed.user.id, ip: ctx.ip, now: ctx.now() });
  }
  return json({ ok: true }, 200, { "set-cookie": buildClearCookie(ctx.secure) });
}

// ---------------------------------------------------------------- me

export async function handleMe(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  const authed = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (!authed) return err("UNAUTHENTICATED", "Not signed in.", 401);
  return json({ user: toPublicUser(authed.user) });
}

// ---------------------------------------------------------------- change password

export async function handleChangePassword(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const authed = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (!authed) return err("UNAUTHENTICATED", "Not signed in.", 401);

  const rl = limitFromEnv(ctx.env, "RL_LOGIN_LIMIT", "RL_LOGIN_WINDOW", 10, 600);
  const gate = await checkRateLimit(ctx.store, `change-pw:${authed.user.id}`, rl, ctx.now());
  if (!gate.allowed) {
    return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(gate.retryAfterSec) });
  }

  const body = await readJson(req);
  const current = typeof body?.currentPassword === "string" ? body.currentPassword : null;
  const next = typeof body?.newPassword === "string" ? body.newPassword : null;
  const pw = checkPassword(next);
  if (!current || !pw.ok || !next) {
    return err("INVALID_INPUT", !current ? "Current password is required." : (pw.message ?? "Invalid password."), 400);
  }
  const fresh = await ctx.store.getUserById(authed.user.id);
  if (!fresh || !(await verifyPassword(current, fresh.password_hash))) {
    return err("INVALID_CREDENTIALS", "Current password is incorrect.", 401);
  }
  const now = ctx.now();
  await ctx.store.updateUser(fresh.id, { password_hash: await hashPassword(next, ctx.env.PBKDF2_ITERATIONS), updated_at: now });
  await ctx.store.deleteUserSessionsExcept(fresh.id, authed.sessionId);
  await audit(ctx.store, "PASSWORD_CHANGED", { actor: fresh.id, target: fresh.id, ip: ctx.ip, now });
  return json({ ok: true });
}

// ---------------------------------------------------------------- profile

export async function handleUpdateProfile(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const authed = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (!authed) return err("UNAUTHENTICATED", "Not signed in.", 401);
  const body = await readJson(req);
  const displayName = body ? checkDisplayName(body.displayName) : null;
  if (!displayName) return err("INVALID_INPUT", "Enter a valid display name (1-60 characters).", 400);
  const now = ctx.now();
  await ctx.store.updateUser(authed.user.id, { display_name: displayName, updated_at: now });
  await audit(ctx.store, "PROFILE_UPDATED", { actor: authed.user.id, target: authed.user.id, ip: ctx.ip, now });
  const updated = await ctx.store.getUserById(authed.user.id);
  return json({ user: updated ? toPublicUser(updated) : toPublicUser(authed.user) });
}

// ---------------------------------------------------------------- password reset

export async function handleRequestPasswordReset(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const rl = limitFromEnv(ctx.env, "RL_RESET_LIMIT", "RL_RESET_WINDOW", 5, 3600);
  const gate = await checkRateLimit(ctx.store, `reset:${ctx.ip ?? "unknown"}`, rl, ctx.now());
  if (!gate.allowed) {
    return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(gate.retryAfterSec) });
  }
  const body = await readJson(req);
  const email = body ? normalizeEmail(body.email) : null;
  // Neutral response in all cases — never reveal whether the email exists.
  if (!email) return json({ ok: true });
  const user = await ctx.store.getUserByEmail(email);
  const now = ctx.now();
  if (user && user.status !== "DISABLED") {
    await ctx.store.expireUserResets(user.id);
    const token = randomToken();
    await ctx.store.insertReset({
      id: newId("rst"),
      user_id: user.id,
      token_hash: await sha256Hex(token),
      status: "PENDING",
      created_at: now,
      expires_at: now + 60 * 60 * 1000,
      used_at: null,
    });
    await ctx.mailer.sendPasswordReset(email, flowLink(ctx.origin, "/reset-password", token), now);
    await audit(ctx.store, "PASSWORD_RESET_REQUESTED", { target: user.id, ip: ctx.ip, now });
  }
  return json({ ok: true });
}

export async function handleResetPassword(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const rl = limitFromEnv(ctx.env, "RL_RESET_LIMIT", "RL_RESET_WINDOW", 5, 3600);
  const gate = await checkRateLimit(ctx.store, `reset-use:${ctx.ip ?? "unknown"}`, rl, ctx.now());
  if (!gate.allowed) {
    return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(gate.retryAfterSec) });
  }
  const body = await readJson(req);
  const token = body ? checkToken(body.token) : null;
  const next = body && typeof body.newPassword === "string" ? body.newPassword : null;
  const pw = checkPassword(next);
  if (!token || !pw.ok || !next) {
    return err("INVALID_INPUT", !token ? "Invalid or expired reset link." : (pw.message ?? "Invalid password."), 400);
  }
  await ctx.store.expireResets(ctx.now());
  const row = await ctx.store.getResetByTokenHash(await sha256Hex(token));
  if (!row || row.status !== "PENDING" || row.expires_at <= ctx.now()) {
    return err("RESET_INVALID", "This reset link is invalid, expired, or already used.", 410);
  }
  const user = await ctx.store.getUserById(row.user_id);
  if (!user || user.status === "DISABLED") {
    return err("RESET_INVALID", "This reset link is invalid, expired, or already used.", 410);
  }
  const claimed = await ctx.store.claimReset(row.id, ctx.now());
  if (!claimed) return err("RESET_INVALID", "This reset link is invalid, expired, or already used.", 410);
  const now = ctx.now();
  await ctx.store.updateUser(user.id, { password_hash: await hashPassword(next, ctx.env.PBKDF2_ITERATIONS), updated_at: now });
  await ctx.store.deleteUserSessions(user.id);
  await audit(ctx.store, "PASSWORD_RESET_COMPLETED", { target: user.id, ip: ctx.ip, now });
  return json({ ok: true });
}

// ---------------------------------------------------------------- email verification

export async function handleRequestVerification(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const rl = limitFromEnv(ctx.env, "RL_VERIFY_LIMIT", "RL_VERIFY_WINDOW", 10, 3600);
  const gate = await checkRateLimit(ctx.store, `verify-send:${ctx.ip ?? "unknown"}`, rl, ctx.now());
  if (!gate.allowed) {
    return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(gate.retryAfterSec) });
  }
  const body = await readJson(req);
  const email = body ? normalizeEmail(body.email) : null;
  if (!email) return json({ ok: true });
  const user = await ctx.store.getUserByEmail(email);
  const now = ctx.now();
  if (user && user.status === "PENDING_VERIFICATION") {
    await ctx.store.expireUserVerifications(user.id);
    const token = randomToken();
    await ctx.store.insertVerification({
      id: newId("evf"),
      user_id: user.id,
      token_hash: await sha256Hex(token),
      status: "PENDING",
      created_at: now,
      expires_at: now + 24 * 60 * 60 * 1000,
      used_at: null,
    });
    await ctx.mailer.sendVerification(email, flowLink(ctx.origin, "/verify-email", token), now);
    await audit(ctx.store, "EMAIL_VERIFICATION_SENT", { target: user.id, ip: ctx.ip, now });
  }
  return json({ ok: true });
}

export async function handleVerifyEmail(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const rl = limitFromEnv(ctx.env, "RL_VERIFY_LIMIT", "RL_VERIFY_WINDOW", 10, 3600);
  const gate = await checkRateLimit(ctx.store, `verify-use:${ctx.ip ?? "unknown"}`, rl, ctx.now());
  if (!gate.allowed) {
    return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(gate.retryAfterSec) });
  }
  const body = await readJson(req);
  const token = body ? checkToken(body.token) : null;
  if (!token) return err("INVALID_INPUT", "Invalid or expired verification link.", 400);
  await ctx.store.expireVerifications(ctx.now());
  const row = await ctx.store.getVerificationByTokenHash(await sha256Hex(token));
  if (!row || row.status !== "PENDING" || row.expires_at <= ctx.now()) {
    return err("VERIFICATION_INVALID", "This verification link is invalid, expired, or already used.", 410);
  }
  const user = await ctx.store.getUserById(row.user_id);
  if (!user || user.status === "DISABLED") {
    return err("VERIFICATION_INVALID", "This verification link is invalid, expired, or already used.", 410);
  }
  const claimed = await ctx.store.claimVerification(row.id, ctx.now());
  if (!claimed) return err("VERIFICATION_INVALID", "This verification link is invalid, expired, or already used.", 410);
  const now = ctx.now();
  await ctx.store.updateUser(user.id, { email_verified: 1, status: "ACTIVE", updated_at: now });
  await audit(ctx.store, "EMAIL_VERIFIED", { target: user.id, ip: ctx.ip, now });
  return json({ ok: true });
}

// ---------------------------------------------------------------- admin

export type AdminAuth = { ok: true; userId: string | null } | { ok: false; result: HandlerResult };

async function adminAuth(ctx: HandlerContext, req: Request): Promise<AdminAuth> {
  // 1. Admin session (preferred).
  const authed = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (authed && (authed.user.role === "ADMIN" || authed.user.role === "OWNER")) {
    return { ok: true, userId: authed.user.id };
  }
  // 2. One-time bootstrap token (operator seeding; remove after first admin).
  const presented = req.headers.get("x-admin-token");
  if (ctx.env.ADMIN_BOOTSTRAP_TOKEN && presented && presented === ctx.env.ADMIN_BOOTSTRAP_TOKEN) {
    return { ok: true, userId: null };
  }
  return { ok: false, result: err("FORBIDDEN", "Forbidden.", 403) };
}

const ADMIN_ROLES: Role[] = ["OWNER", "ADMIN", "USER"];

export async function handleCreateInvite(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const rl = limitFromEnv(ctx.env, "RL_ADMIN_LIMIT", "RL_ADMIN_WINDOW", 30, 3600);
  const gate = await checkRateLimit(ctx.store, `admin-invite:${ctx.ip ?? "unknown"}`, rl, ctx.now());
  if (!gate.allowed) {
    return json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, 429, { "retry-after": String(gate.retryAfterSec) });
  }
  const auth = await adminAuth(ctx, req);
  if (!auth.ok) return auth.result;

  const body = await readJson(req);
  const intendedEmail = body?.intendedEmail !== undefined ? normalizeEmail(body.intendedEmail) : undefined;
  if (body?.intendedEmail !== undefined && intendedEmail === undefined) {
    return err("INVALID_INPUT", "Enter a valid email address or omit the field.", 400);
  }
  let role: Role = "USER";
  if (typeof body?.role === "string" && (ADMIN_ROLES as string[]).includes(body.role)) {
    role = body.role as Role;
    // Session admins cannot escalate: ADMIN may only invite USER.
    if (auth.userId) {
      const me = await ctx.store.getUserById(auth.userId);
      if (!me || me.role !== "OWNER") role = "USER";
    }
  }
  const ttlHoursRaw = typeof body?.ttlHours === "number" ? body.ttlHours : 72;
  const ttlHours = Number.isFinite(ttlHoursRaw) ? Math.min(Math.max(ttlHoursRaw, 1), 24 * 30) : 72;
  const note = typeof body?.note === "string" ? body.note.slice(0, 200) : null;

  const now = ctx.now();
  const token = randomToken();
  const inv = {
    id: newId("inv"),
    token_hash: await sha256Hex(token),
    status: "PENDING" as const,
    intended_email: intendedEmail ?? null,
    role,
    inviter_user_id: auth.userId,
    created_at: now,
    expires_at: now + ttlHours * 60 * 60 * 1000,
    used_at: null,
    used_by_user_id: null,
    revoked_at: null,
    note,
  };
  await ctx.store.insertInvitation(inv);
  await audit(ctx.store, "INVITATION_CREATED", { actor: auth.userId, ip: ctx.ip, detail: `invite:${inv.id} role:${role}`, now });
  // Raw token is returned ONCE here; it is never stored or logged.
  return json({ id: inv.id, token, expiresAt: inv.expires_at, role }, 201);
}

export async function handleListInvites(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  const auth = await adminAuth(ctx, req);
  if (!auth.ok) return auth.result;
  await ctx.store.expireInvitations(ctx.now());
  const rows = await ctx.store.listInvitations(100);
  // Never expose token hashes.
  return json({
    invitations: rows.map((r) => ({
      id: r.id,
      status: r.status,
      intended_email: r.intended_email,
      role: r.role,
      inviter_user_id: r.inviter_user_id,
      created_at: r.created_at,
      expires_at: r.expires_at,
      used_at: r.used_at,
      used_by_user_id: r.used_by_user_id,
      revoked_at: r.revoked_at,
      note: r.note,
    })),
  });
}

export async function handleRevokeInvite(ctx: HandlerContext, req: Request, id: string): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  const auth = await adminAuth(ctx, req);
  if (!auth.ok) return auth.result;
  if (!/^inv_[0-9a-f]{24}$/.test(id)) return err("NOT_FOUND", "Invitation not found.", 404);
  const ok = await ctx.store.revokeInvitation(id, ctx.now());
  if (!ok) return err("NOT_FOUND", "Invitation not found or no longer pending.", 404);
  await audit(ctx.store, "INVITATION_REVOKED", { actor: auth.userId, ip: ctx.ip, detail: `invite:${id}`, now: ctx.now() });
  return json({ ok: true });
}

export async function handleSetUserStatus(
  ctx: HandlerContext,
  req: Request,
  id: string,
  status: "DISABLED" | "ACTIVE"
): Promise<HandlerResult> {
  if (!sameOrigin(req, ctx.origin)) return err("FORBIDDEN", "Forbidden.", 403);
  // Destructive: session admins only, never the bootstrap token.
  const authed = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (!authed || (authed.user.role !== "ADMIN" && authed.user.role !== "OWNER")) {
    return err("FORBIDDEN", "Forbidden.", 403);
  }
  if (!/^usr_[0-9a-f]{24}$/.test(id)) return err("NOT_FOUND", "User not found.", 404);
  if (id === authed.user.id) return err("INVALID_INPUT", "You cannot change your own status.", 400);
  const target = await ctx.store.getUserById(id);
  if (!target) return err("NOT_FOUND", "User not found.", 404);
  // ADMIN cannot touch OWNER accounts or other ADMINs; OWNER can touch all.
  if (authed.user.role !== "OWNER" && target.role !== "USER") {
    return err("FORBIDDEN", "Forbidden.", 403);
  }
  const now = ctx.now();
  await ctx.store.updateUser(id, { status, updated_at: now });
  if (status === "DISABLED") await ctx.store.deleteUserSessions(id);
  await audit(ctx.store, status === "DISABLED" ? "ACCOUNT_DISABLED" : "ACCOUNT_ENABLED", {
    actor: authed.user.id,
    target: id,
    ip: ctx.ip,
    now,
  });
  const updated = await ctx.store.getUserById(id);
  return json({ user: updated ? toPublicUser(updated) : null });
}
