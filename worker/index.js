// Maps a flat RSC payload request (client form) to the nested file path
// produced by `next build` with `output: "export"` (disk form).
//   /forge/__next.forge.__PAGE__.txt
//     -> /forge/__next.forge/__PAGE__.txt
//   /forge/projects/toolboxhq/__next.forge.projects.toolboxhq.__PAGE__.txt
//     -> /forge/projects/toolboxhq/__next.forge/projects/toolboxhq/__PAGE__.txt
// Returns null when the pathname is not a payload request.
function rscPayloadAlias(pathname) {
  const slash = pathname.lastIndexOf("/");
  if (slash < 0) return null;
  const dir = pathname.slice(0, slash) || "/";
  const file = pathname.slice(slash + 1);
  const m = /^__next\.([A-Za-z0-9_.-]+)\.__PAGE__\.txt$/.exec(file);
  if (!m) return null;
  const segs = m[1].split(".");
  if (segs.some((s) => !s || s === "." || s === "..")) return null;
  // Only rewrite when the dotted name matches the directory route, so
  // arbitrary URLs can never alias to unrelated files.
  if (dir !== "/" + segs.join("/")) return null;
  const rest = segs.length === 1 ? "" : segs.slice(1).join("/") + "/";
  return `${dir === "/" ? "" : dir}/__next.${segs[0]}/${rest}__PAGE__.txt`;
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const candidates = [
      pathname,
      pathname === "/"
        ? "/index.html"
        : pathname.replace(/\/+$/, "") + ".html",
      pathname === "/" ? null : pathname + "/index.html",
      // Next.js static export emits RSC flight-data payloads in nested form,
      // e.g. /forge/__next.forge/__PAGE__.txt, while the client requests the
      // flat form /forge/__next.forge.__PAGE__.txt. Rewrite the flat form to
      // the nested form so client-side navigation/prefetch keeps working
      // instead of 404ing and falling back to full page reloads.
      rscPayloadAlias(pathname),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const req = new Request(new URL(candidate, url), request);
      const res = await env.ASSETS.fetch(req).catch(() => null);
      if (res && res.ok) return res;
    }

    const notFound = await env.ASSETS.fetch(
      new URL("/404.html", url)
    ).catch(() => null);
    if (notFound && notFound.ok) {
      return new Response(notFound.body, {
        status: 404,
        headers: notFound.headers,
      });
    }
    return new Response("Not Found", { status: 404 });
  },
};

export default worker;