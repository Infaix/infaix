import { relativeDestination, uniqueRoutingParameters } from "../../src/lib/relative-destination";
import { configuredChatOrigins } from "./chat-origin";
import { configuredStudyOrigins } from "./study-origin";
import { STUDY_HANDOFF_CALLBACK_PATH } from "./study-handoff-contract";
import type { Env } from "./types";

export type CoreContinuation =
  | { kind: "valid" | "fallback"; destination: string }
  | { kind: "rejected"; code: "INVALID_REDIRECT" };

/** A callback is an absolute configured product URL, NOT Core returnTo or next. */
export function validateProductCallback(raw: string, origins: readonly string[], callbackPath: string): URL | null {
  if (raw.length > 2048 || /[\s\\\u0000-\u001f\u007f-\u009f]/.test(raw) || raw.includes("#")) return null;
  // Compare the literal authority/path before WHATWG normalization can hide
  // credentials, default ports, path traversal, or encoded path segments.
  const prefix = raw.split("?", 1)[0];
  if (!origins.some((origin) => prefix === origin + callbackPath)) return null;
  let parsed: URL;
  try { decodeURIComponent(raw); parsed = new URL(raw); } catch { return null; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || parsed.pathname !== callbackPath || !origins.includes(parsed.origin)) return null;
  if (!uniqueRoutingParameters(parsed.searchParams) || [...parsed.searchParams.keys()].some((key) => key !== "next")) return null;
  const next = parsed.searchParams.get("next");
  if (next !== null && relativeDestination(next, 500) === null) return null;
  return parsed;
}

export function validateHandoffContinuation(url: URL, origins: readonly string[], callbackPath: string): URL | null {
  if (url.hash || !uniqueRoutingParameters(url.searchParams) || [...url.searchParams.keys()].some((key) => key !== "return_to")) return null;
  return validateProductCallback(url.searchParams.get("return_to") ?? origins[0] + callbackPath, origins, callbackPath);
}

/** Explicit malformed product handoffs are rejectable, never disguised as fallback. */
export function validateCoreContinuation(raw: string | null | undefined, env: Env): CoreContinuation {
  const rejected = { kind: "rejected", code: "INVALID_REDIRECT" } as const;
  const product = raw?.match(/^\/api\/auth\/(chat|study)(?:[?#]|$)/)?.[1];
  const destination = relativeDestination(raw, 2048);
  if (!destination) return product ? rejected : { kind: "fallback", destination: "/account" };
  const url = new URL(destination, "https://core.invalid");
  if (!uniqueRoutingParameters(url.searchParams)) return product ? rejected : { kind: "fallback", destination: "/account" };
  if (product) {
    const origins = product === "chat" ? configuredChatOrigins(env) : configuredStudyOrigins(env);
    const path = product === "chat" ? "/api/auth/core/callback" : STUDY_HANDOFF_CALLBACK_PATH;
    if (!origins || !validateHandoffContinuation(url, origins, path)) return rejected;
  } else if (url.pathname.startsWith("/api/auth/") && url.searchParams.has("return_to")) return rejected;
  return { kind: "valid", destination };
}
