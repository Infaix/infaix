/** Pure validation shared by browser UX and the authoritative Worker boundary.
 * Decode each layer once, never recursively decode nested callback URLs.
 */
export function relativeDestination(raw: string | null | undefined, maximum: number): string | null {
  if (!raw || raw.length > maximum || !raw.startsWith("/") || raw.startsWith("//") || /[\s\\<>"'`]/.test(raw)) return null;
  const path = raw.split(/[?#]/, 1)[0];
  // Path separators and another encoding layer are not valid path data here.
  if (/%(?:2f|5c|25)/i.test(path)) return null;
  let decodedPath: string;
  let decodedLayer: string;
  try { decodedPath = decodeURIComponent(path); decodedLayer = decodeURIComponent(raw); }
  catch { return null; }
  if (/[\u0000-\u001f\u007f-\u009f\\]/.test(decodedLayer) || decodedPath.includes(":")) return null;
  if (decodedPath.split("/").some((part) => part === "." || part === "..")) return null;
  return raw;
}

export function uniqueRoutingParameters(params: URLSearchParams): boolean {
  return ["returnTo", "return_to", "next"].every((key) => params.getAll(key).length <= 1);
}
