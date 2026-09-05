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
    return { ok: false, status: 0, data: null, code: "NETWORK", message: "Could not reach INFAIX. Check your connection." };
  }
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    return { ok: false, status: res.status, data: null, code: "BAD_RESPONSE", message: "Unexpected response from INFAIX." };
  }
  if (!res.ok) {
    const e = (parsed as { error?: { code?: string; message?: string } }).error;
    return { ok: false, status: res.status, data: null, code: e?.code ?? "ERROR", message: e?.message ?? "Something went wrong." };
  }
  return { ok: true, status: res.status, data: parsed as T, code: null, message: null };
}

export interface PublicUser {
  id: string;
  email: string;
  display_name: string;
  role: "OWNER" | "ADMIN" | "USER";
  status: "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION";
  email_verified: boolean;
  created_at: number;
  last_login_at: number | null;
}
