import type { Env } from "./types";

function strictHttpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.origin !== value ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Primary Chat origin plus optional extra origins. Any malformed value fails closed. */
export function configuredChatOrigins(env: Env): string[] | null {
  const primary = strictHttpsOrigin(env.CHAT_ORIGIN);
  if (!primary) return null;
  const extras = (env.CHAT_EXTRA_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const origins = [primary];
  for (const extra of extras) {
    const parsed = strictHttpsOrigin(extra);
    if (!parsed) return null;
    if (!origins.includes(parsed)) origins.push(parsed);
  }
  return origins;
}
