// Sliding-window rate limiting backed by D1 (works across isolates,
// unlike in-memory counters). Limits are env-configurable; denials
// return 429 with a Retry-After hint. Scopes always include the client
// IP; sensitive endpoints add the account identifier too.
import type { Store } from "./store";
import type { Env } from "./types";

export interface RateLimit {
  limit: number;
  windowSec: number;
}

function num(raw: string | undefined, fallback: number): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) return fallback;
  return n;
}

function envStr(env: Env, key: string): string | undefined {
  const v: unknown = (env as unknown as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

export function limitFromEnv(env: Env, limitKey: string, windowKey: string, defLimit: number, defWindow: number): RateLimit {
  return {
    limit: num(envStr(env, limitKey), defLimit),
    windowSec: num(envStr(env, windowKey), defWindow),
  };
}

export interface RateCheck {
  allowed: boolean;
  retryAfterSec: number;
  count: number;
}

export async function checkRateLimit(
  store: Store,
  scope: string,
  rule: RateLimit,
  nowMs: number
): Promise<RateCheck> {
  const windowStart = Math.floor(nowMs / (rule.windowSec * 1000)) * rule.windowSec * 1000;
  const count = await store.hitRateLimit(`${scope}`, windowStart);
  if (count <= rule.limit) {
    return { allowed: true, retryAfterSec: 0, count };
  }
  const retryAfterSec = Math.max(1, Math.ceil((windowStart + rule.windowSec * 1000 - nowMs) / 1000));
  return { allowed: false, retryAfterSec, count };
}
