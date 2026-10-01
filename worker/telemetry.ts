/** Bounded route labels only. Never emit query strings, IDs, headers or bodies. */
export function routeLabel(path: string): string {
  if (/^\/api\/auth\/(me|chat|register|login|logout|change-password|profile|request-password-reset|reset-password|request-verification|verify-email)$/.test(path)) return path;
  if (/^\/api\/admin\/(operations|users|invites)$/.test(path)) return path;
  if (/^\/api\/admin\/users\/[^/]+\/(disable|enable|ai-access)$/.test(path)) return path.replace(/\/users\/[^/]+\//, "/users/:id/");
  if (/^\/api\/admin\/invites\/[^/]+\/revoke$/.test(path)) return "/api/admin/invites/:id/revoke";
  if (/^\/api\/ai\/(models|chat|conversations)$/.test(path)) return path;
  if (/^\/api\/ai\/conversations\/[^/]+$/.test(path)) return "/api/ai/conversations/:id";
  if (path === "/api/apps") return path;
  return "/api/other";
}

export function requestMetadata(req: Request, status: number, started: number, ended: number) {
  const route = routeLabel(new URL(req.url).pathname);
  return {
    event: "core_request", timestamp: new Date(ended).toISOString(), service: "core", route,
    method: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(req.method) ? req.method : "OTHER",
    status, latency_ms: Math.max(0, ended - started),
    error_code: status >= 500 ? "SERVER_ERROR" : status >= 400 ? "REQUEST_REJECTED" : null,
    authentication_result: route === "/api/auth/login" ? (status === 200 ? "success" : "not_successful") : null,
    version: null,
  };
}
