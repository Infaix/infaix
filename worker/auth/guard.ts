// Reusable server-side authentication/authorization primitives.
// Future protected endpoints (including INFAIX AI) use these instead of
// duplicating logic:
//
//   const auth = await requireAuthentication(ctx, req);
//   if (!auth.ok) return auth.result; // 401 Response
//   auth.user // server-resolved UserRow — never trust client-provided IDs
//
//   const admin = requireRole(auth, ["OWNER", "ADMIN"]);
//   if (!admin.ok) return admin.result; // 403 Response
import { verifySession, type SessionContext } from "./sessions";
import type { Role, UserRow } from "./types";

export interface GuardContext extends SessionContext {
  cookieHeader: string | null;
}

export type AuthResult =
  | { ok: true; user: UserRow; sessionId: string }
  | { ok: false; result: Response };

export async function requireAuthentication(ctx: GuardContext): Promise<AuthResult> {
  const authed = await verifySession(ctx, ctx.cookieHeader);
  if (!authed) {
    return {
      ok: false,
      result: Response.json({ error: { code: "UNAUTHENTICATED", message: "Not signed in." } }, { status: 401 }),
    };
  }
  return { ok: true, user: authed.user, sessionId: authed.sessionId };
}

export type RoleResult = { ok: true; user: UserRow } | { ok: false; result: Response };

/** Role gate for the future OWNER > ADMIN > USER hierarchy. */
export function requireRole(auth: AuthResult, roles: Role[]): RoleResult {
  if (!auth.ok) return auth;
  if (!roles.includes(auth.user.role)) {
    return {
      ok: false,
      result: Response.json({ error: { code: "FORBIDDEN", message: "Forbidden." } }, { status: 403 }),
    };
  }
  return { ok: true, user: auth.user };
}
