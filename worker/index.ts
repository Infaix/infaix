// INFAIX Cloudflare Worker: static site delivery + account API.
//
// Static export files in ./out are served first (exact path, .html
// variants, RSC payload alias). /api/* requests are handled by the
// account system in ./auth (D1 + Web Crypto, no external dependencies).
import { handleApi } from "./auth/router";
import { corsHeaders, handlePreflight } from "./auth/cors";
import type { Env } from "./auth/types";
import { getPublicApps } from "../src/lib/app-registry";
import { requestMetadata } from "./telemetry";

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

/**
 * Content-Security-Policy built from what the exported site actually loads,
 * not from a generic template. Invented from `out/` of this build:
 *
 * - every script tag is same-origin (`/_next/static/chunks/...`) or an inline
 *   Next.js RSC bootstrap payload (53 inline <script> blocks at last count);
 * - no <iframe>, <embed> or <object> anywhere;
 * - no external stylesheet, font or image host — CSS and assets are all
 *   same-origin;
 * - all API traffic, including the AI bridge, is same-origin;
 * - ~10 inline `style` attributes from the ambient/canvas presentation.
 *
 * 'unsafe-inline' in script-src is a real limitation, stated plainly: a
 * static export cannot carry a per-response nonce, and the RSC bootstrap
 * requires inline execution. The directive still refuses scripts from any
 * foreign origin and refuses inline use of the base URI, framing and form
 * targets below. Removing the inline allowance needs per-request nonces,
 * which is not possible while HTML is served as immutable static files.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

/** Only the capabilities this site has no use for are denied outright. */
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

function secureHeaders(res: Response, env: Env): Response {
  const headers = new Headers(res.headers);
  if (!headers.has("x-content-type-options")) headers.set("X-Content-Type-Options", "nosniff");
  // Verification and reset links carry single-use tokens in the URL path
  // query. Referer is never needed here (no third-party resources at all), so
  // nothing is sent — that closes same-origin Referer leakage of a live token.
  if (!headers.has("referrer-policy")) headers.set("Referrer-Policy", "no-referrer");
  if (!headers.has("content-security-policy")) headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  if (!headers.has("permissions-policy")) headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  // HSTS is an HTTPS-only production commitment. The session cookie is already
  // scoped to Domain=.infaix.com, so the parent domain and its subdomains must
  // all be HTTPS-capable for this to be safe; see SECURITY.md.
  if (env.ENVIRONMENT === "production" && !headers.has("strict-transport-security")) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/** Attach validated CORS headers (allowlisted origin + credentials). */
function withCors(req: Request, env: Env, workerOrigin: string, res: Response): Response {
  const cors = corsHeaders(req, env, workerOrigin);
  if (!Object.keys(cors).length) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/** Production refuses to serve the API without a real session secret. */
function sessionSecretValid(env: Env): boolean {
  return !!env.SESSION_SECRET && env.SESSION_SECRET.length >= 32;
}

function toResponse(result: { status: number; body: unknown; headers?: Record<string, string> }, env: Env): Response {
  const headers = new Headers(result.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return secureHeaders(new Response(JSON.stringify(result.body), { status: result.status, headers }), env);
}

async function handleApiRequest(
  req: Request,
  env: Env,
  url: URL,
  executionCtx?: { waitUntil(task: Promise<unknown>): void }
): Promise<Response | null> {
  const result = await handleApi(req, env, url, executionCtx);
  if (!result) return null;
  const res = result instanceof Response ? result : toResponse(result, env);
  return withCors(req, env, url.origin, secureHeaders(res, env));
}

const worker = {
  async fetch(request: Request, env: Env, executionCtx: { waitUntil(task: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/api/apps" && request.method === "GET") {
      return secureHeaders(Response.json({ version: 1, applications: getPublicApps() }, { headers: { "cache-control": "public, max-age=300" } }), env);
    }

    // Account API takes precedence over static files under /api/.
    if (pathname.startsWith("/api/")) {
      const preflight = handlePreflight(request, env, url.origin);
      if (preflight) return secureHeaders(preflight, env);
      if (!env.INFAIX_DB || (env.ENVIRONMENT === "production" && !sessionSecretValid(env))) {
        return secureHeaders(
          withCors(
            request,
            env,
            url.origin,
            Response.json({ error: { code: "AUTH_UNAVAILABLE", message: "Authentication is temporarily unavailable." } }, { status: 503 })
          ),
          env
        );
      }
      try {
        const res = await handleApiRequest(request, env, url, executionCtx);
        if (res) return res;
      } catch {
        // Never leak internals; static site keeps working regardless.
        if (pathname === "/api/auth/register") {
          console.error(JSON.stringify({ phase: "register:unhandled", elapsed_ms: 0, request_id: "edge-catch", pbkdf2_iterations: 0 }));
        } else {
          console.error(JSON.stringify({ event: "core_api_error", error_code: "INTERNAL" }));
        }
        return secureHeaders(
          withCors(
            request,
            env,
            url.origin,
            Response.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 })
          ),
          env
        );
      }
    }

    const assets = env.ASSETS;
    if (!assets) return secureHeaders(new Response("Not Found", { status: 404 }), env);

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
      if (res && res.ok) return secureHeaders(withCacheHeaders(candidate, res), env);
    }

    const notFound = await assets.fetch(new URL("/404.html", url)).catch(() => null);
    if (notFound && notFound.ok) {
      return secureHeaders(
        new Response(notFound.body, {
          status: 404,
          headers: notFound.headers,
        }),
        env
      );
    }
    return secureHeaders(new Response("Not Found", { status: 404 }), env);
  },
};

const instrumentedWorker = {
  async fetch(request: Request, env: Env, executionCtx: { waitUntil(task: Promise<unknown>): void }): Promise<Response> {
    const started = Date.now();
    const response = await worker.fetch(request, env, executionCtx);
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/")) {
      console.log(JSON.stringify(requestMetadata(request, response.status, started, Date.now())));
      if (pathname !== "/api/apps") response.headers.set("cache-control", "no-store");
    }
    return response;
  },
};

export default instrumentedWorker;
