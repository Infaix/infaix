"use client";

// Strict same-origin return-destination validation for login redirects.
//
// Only internal absolute paths are allowed (e.g. `/account`, `/ai`).
// Everything else — absolute URLs, protocol-relative URLs, schemes,
// backslashes, traversal, encoded tricks, whitespace/control chars —
// falls back. This makes `?returnTo=` safe against open redirects.
export function safeReturnTo(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw) return fallback;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//")) return fallback;
  if (v.length > 500) return fallback;
  if (/[\s<>"'`]/.test(v)) return fallback;
  // Decode once so encoded tricks (`%2F`, `%5C`, `%2e`) cannot smuggle
  // `//`, `\`, or `..` past the checks below.
  let decoded = v;
  try {
    decoded = decodeURIComponent(v);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
  if (decoded.includes("\\")) return fallback;
  const pathPart = decoded.split(/[?#]/, 1)[0] ?? "";
  // A colon in the path part would be a scheme (`javascript:…`) or an
  // unusual path — reject conservatively (query/hash may keep `:`).
  if (pathPart.includes(":")) return fallback;
  const segments = pathPart.split("/");
  if (segments.some((s) => s === "." || s === "..")) return fallback;
  return v;
}
