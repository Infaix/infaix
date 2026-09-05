// INFAIX Cloudflare Worker: static site delivery + account API.
//
// Static export files in ./out are served first (exact path, .html
// variants, RSC payload alias). /api/* requests are handled by the
// account system in ./auth (D1 + Web Crypto, no external dependencies).
import { handleApi } from "./auth/router";
import type { Env } from "./auth/types";

// Maps a flat RSC payload request (client form) to the nested file path
// produced by `next build` with `output: "export"` (disk form).
//   /forge/__next.forge.__PAGE__.txt
//     -> /forge/__next.forge/__PAGE__.txt
//   /forge/projects/toolboxhq/__next.forge.projects.toolboxhq.__PAGE__.txt
//     -> /forge/projects/toolboxhq/__next.forge/projects/toolboxhq/__PAGE__.txt
// Returns null when the pathname is not a payload request.
function rscPayloadAlias(pathname: string): string | null {
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

// Explicit edge/browser cache policy. Hashed Next.js assets are immutable;
// the unversioned brand assets get a day of freshness plus a week of
// stale-while-revalidate so a slow edge never blocks rendering. HTML
// documents are intentionally left untouched (deployment semantics).
function cachePolicy(pathname: string): string | null {
  if (pathname.startsWith("/_next/static/")) {
    return "public, max-age=31536000, immutable";
  }
  if (pathname === "/infaix-logo.png" || pathname === "/favicon.ico") {
    return "public, max-age=86400, stale-while-revalidate=604800";
  }
  return null;
}

function withCacheHeaders(pathname: string, res: Response): Response {
  const policy = cachePolicy(pathname);
  if (!policy) return res;
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", policy);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function secureHeaders(res: Response): Response {
  // nosniff only: safe for every content type we serve, breaks nothing.
  if (res.headers.has("x-content-type-options")) return res;
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function toResponse(result: { status: number; body: unknown; headers?: Record<string, string> }): Response {
  const headers = new Headers(result.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return secureHeaders(new Response(JSON.stringify(result.body), { status: result.status, headers }));
}

async function handleApiRequest(
  req: Request,
  env: Env,
  url: URL,
  executionCtx?: { waitUntil(task: Promise<unknown>): void }
): Promise<Response | null> {
  const result = await handleApi(req, env, url, executionCtx);
  if (!result) return null;
  if (result instanceof Response) return secureHeaders(result);
  return toResponse(result);
}

const worker = {
  async fetch(request: Request, env: Env, executionCtx: { waitUntil(task: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Account API takes precedence over static files under /api/.
    if (pathname.startsWith("/api/")) {
      if (!env.INFAIX_DB) {
        return secureHeaders(
          Response.json({ error: { code: "AUTH_UNAVAILABLE", message: "Authentication is temporarily unavailable." } }, { status: 503 })
        );
      }
      try {
        const res = await handleApiRequest(request, env, url, executionCtx);
        if (res) return res;
      } catch (e) {
        // Never leak internals; static site keeps working regardless.
        console.error("api error", e instanceof Error ? e.message : "unknown");
        return secureHeaders(Response.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 }));
      }
    }

    const assets = env.ASSETS;
    if (!assets) return secureHeaders(new Response("Not Found", { status: 404 }));

    const candidates = [
      pathname,
      pathname === "/" ? "/index.html" : pathname.replace(/\/+$/, "") + ".html",
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
      const res = await assets.fetch(req).catch(() => null);
      if (res && res.ok) return secureHeaders(withCacheHeaders(candidate, res));
    }

    const notFound = await assets.fetch(new URL("/404.html", url)).catch(() => null);
    if (notFound && notFound.ok) {
      return secureHeaders(
        new Response(notFound.body, {
          status: 404,
          headers: notFound.headers,
        })
      );
    }
    return secureHeaders(new Response("Not Found", { status: 404 }));
  },
};

export default worker;
