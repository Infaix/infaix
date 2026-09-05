// /api/* routing for the account system. Used by worker/index.ts and
// importable in tests.
import {
  handleAiChat,
  handleAiConversation,
  handleAiConversations,
  handleAiModels,
} from "./ai";
import {
  handleChangePassword,
  handleCreateInvite,
  handleListInvites,
  handleListUsers,
  handleLogin,
  handleLogout,
  handleMe,
  handleRegister,
  handleRequestPasswordReset,
  handleRequestVerification,
  handleResetPassword,
  handleRevokeInvite,
  handleSetAiAccess,
  handleSetUserStatus,
  handleUpdateProfile,
  handleVerifyEmail,
  type HandlerContext,
  type HandlerResult,
} from "./handlers";
import { mailerFor } from "./mailer";
import { D1Store } from "./store";
import type { Env } from "./types";

export interface ExecutionCtx {
  waitUntil(task: Promise<unknown>): void;
}

export function apiContext(req: Request, env: Env, url: URL, executionCtx?: ExecutionCtx): HandlerContext {
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
    waitUntil: executionCtx ? (task) => executionCtx.waitUntil(task) : undefined,
  };
}

/** Returns null when the path is not an API route. Handlers may return a
 * HandlerResult (JSON) or a raw Response (streaming). */
export async function handleApi(req: Request, env: Env, url: URL, executionCtx?: ExecutionCtx): Promise<HandlerResult | Response | null> {
  const path = url.pathname;
  if (!path.startsWith("/api/")) return null;
  const ctx = apiContext(req, env, url, executionCtx);
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

  // Owner-only AI access administration (OWNER sessions only).
  if (method === "GET" && path === "/api/admin/users") return handleListUsers(ctx, req);
  const aiAccess = /^\/api\/admin\/users\/([^/]+)\/ai-access$/.exec(path);
  if (method === "POST" && aiAccess) return handleSetAiAccess(ctx, req, aiAccess[1]);

  // AI bridge (session auth + AI_ACCESS enforced inside handlers).
  if (method === "GET" && path === "/api/ai/models") return handleAiModels(ctx, req);
  if (method === "POST" && path === "/api/ai/chat") return handleAiChat(ctx, req);
  if (path === "/api/ai/conversations" && (method === "GET" || method === "POST")) {
    return handleAiConversations(ctx, req);
  }
  const convo = /^\/api\/ai\/conversations\/([^/]+)$/.exec(path);
  if (convo && (method === "GET" || method === "DELETE")) return handleAiConversation(ctx, req, convo[1]);

  return { status: 404, body: { error: { code: "NOT_FOUND", message: "Not found." } } };
}
