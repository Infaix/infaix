// /api/* routing for the account system. Used by worker/index.ts and
// importable in tests.
import {
  handleChangePassword,
  handleCreateInvite,
  handleListInvites,
  handleLogin,
  handleLogout,
  handleMe,
  handleRegister,
  handleRequestPasswordReset,
  handleRequestVerification,
  handleResetPassword,
  handleRevokeInvite,
  handleSetUserStatus,
  handleUpdateProfile,
  handleVerifyEmail,
  type HandlerContext,
  type HandlerResult,
} from "./handlers";
import { mailerFor } from "./mailer";
import { D1Store } from "./store";
import type { Env } from "./types";

export function apiContext(req: Request, env: Env, url: URL): HandlerContext {
  const store = new D1Store(env.INFAIX_DB);
  return {
    store,
    env,
    now: () => Date.now(),
    ip: req.headers.get("cf-connecting-ip"),
    userAgent: req.headers.get("user-agent"),
    origin: url.origin,
    secure: url.protocol === "https:",
    mailer: mailerFor(store, env.ENVIRONMENT),
  };
}

/** Returns null when the path is not an API route. */
export async function handleApi(req: Request, env: Env, url: URL): Promise<HandlerResult | null> {
  const path = url.pathname;
  if (!path.startsWith("/api/")) return null;
  const ctx = apiContext(req, env, url);
  const method = req.method.toUpperCase();

  if (method === "GET" && path === "/api/auth/me") return handleMe(ctx, req);

  if (method === "POST" && path === "/api/auth/register") return handleRegister(ctx, req);
  if (method === "POST" && path === "/api/auth/login") return handleLogin(ctx, req);
  if (method === "POST" && path === "/api/auth/logout") return handleLogout(ctx, req);
  if (method === "POST" && path === "/api/auth/change-password") return handleChangePassword(ctx, req);
  if (method === "POST" && path === "/api/auth/profile") return handleUpdateProfile(ctx, req);
  if (method === "POST" && path === "/api/auth/request-password-reset") return handleRequestPasswordReset(ctx, req);
  if (method === "POST" && path === "/api/auth/reset-password") return handleResetPassword(ctx, req);
  if (method === "POST" && path === "/api/auth/request-verification") return handleRequestVerification(ctx, req);
  if (method === "POST" && path === "/api/auth/verify-email") return handleVerifyEmail(ctx, req);

  if (method === "POST" && path === "/api/admin/invites") return handleCreateInvite(ctx, req);
  if (method === "GET" && path === "/api/admin/invites") return handleListInvites(ctx, req);

  const revoke = /^\/api\/admin\/invites\/([^/]+)\/revoke$/.exec(path);
  if (method === "POST" && revoke) return handleRevokeInvite(ctx, req, revoke[1]);

  const disable = /^\/api\/admin\/users\/([^/]+)\/disable$/.exec(path);
  if (method === "POST" && disable) return handleSetUserStatus(ctx, req, disable[1], "DISABLED");
  const enable = /^\/api\/admin\/users\/([^/]+)\/enable$/.exec(path);
  if (method === "POST" && enable) return handleSetUserStatus(ctx, req, enable[1], "ACTIVE");

  return { status: 404, body: { error: { code: "NOT_FOUND", message: "Not found." } } };
}
