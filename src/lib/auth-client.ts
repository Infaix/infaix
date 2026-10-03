"use client";

// Same-origin API client for the Worker account endpoints.
// Responses are always JSON: { user | ok | invitations | ... } or
// { error: { code, message } }.

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  code: string | null;
  message: string | null;
  retryAfter: string | null;
}

export function rateLimitMessage(result: ApiResult<unknown>): string | null {
  if (result.code !== "RATE_LIMITED") return null;
  const seconds = Number(result.retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `Too many attempts. Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
  }
  return result.message ?? "Too many attempts. Try again later.";
}

export async function api<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, data: null, code: "NETWORK", message: "Could not reach INFAIX. Check your connection.", retryAfter: null };
  }
  let parsed: unknown = null;
  const retryAfter = res.headers.get("retry-after");
  try {
    parsed = await res.json();
  } catch {
    return { ok: false, status: res.status, data: null, code: "BAD_RESPONSE", message: "Unexpected response from INFAIX.", retryAfter };
  }
  if (!res.ok) {
    const e = (parsed as { error?: { code?: string; message?: string } }).error;
    return { ok: false, status: res.status, data: null, code: e?.code ?? "ERROR", message: e?.message ?? "Something went wrong.", retryAfter };
  }
  return { ok: true, status: res.status, data: parsed as T, code: null, message: null, retryAfter: null };
}

export interface PublicUser {
  id: string;
  email: string;
  display_name: string;
  role: "OWNER" | "ADMIN" | "USER";
  status: "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION";
  email_verified: boolean;
  ai_access: boolean;
  created_at: number;
  last_login_at: number | null;
}
