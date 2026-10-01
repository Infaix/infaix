import { INFAIX_APPS } from "../src/lib/app-registry";
import { TIME_RANGES, type TimeRange, type OperationsResponse } from "../src/lib/operations-contract";
import { requireAuthentication, requireRole } from "./auth/guard";
import type { HandlerContext } from "./auth/handlers";
import { checkRateLimit } from "./auth/ratelimit";

export async function handleOperations(ctx: HandlerContext, req: Request): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  const auth = await requireAuthentication({ ...ctx, cookieHeader: req.headers.get("cookie") });
  const allowed = requireRole(auth, ["OWNER", "ADMIN"]);
  if (!allowed.ok) {
    allowed.result.headers.set("cache-control", "no-store");
    return allowed.result;
  }
  const range = new URL(req.url).searchParams.get("range") ?? "24H";
  if (!Object.hasOwn(TIME_RANGES, range)) {
    return Response.json({ error: { code: "INVALID_RANGE", message: "Choose 1H, 6H, 24H, 7D or 30D." } }, { status: 400, headers });
  }
  const gate = await checkRateLimit(ctx.store, `operations:${allowed.user.id}`, { limit: 60, windowSec: 60 }, ctx.now());
  if (!gate.allowed) return Response.json({ error: { code: "RATE_LIMITED", message: "Please wait before refreshing." } }, { status: 429, headers: { ...headers, "retry-after": String(gate.retryAfterSec) } });
  const to = ctx.now();
  const from = to - TIME_RANGES[range as TimeRange];
  const bucketMs = TIME_RANGES[range as TimeRange] / 24;
  try {
    const snapshot = await ctx.store.operationsSnapshot(from, to, bucketMs);
    // Explicit projection: never expose arbitrary audit event strings or details.
    const { AUDIT_EVENTS } = await import("./auth/audit");
    const names: readonly string[] = AUDIT_EVENTS;
    const safeEvent = (event: string) => names.includes(event) ? event : "OTHER_EVENT";
    const body: OperationsResponse = {
      range: range as TimeRange, from, to, bucketMs,
      role: allowed.user.role as "OWNER" | "ADMIN",
      environment: ["production", "development", "test"].includes(ctx.env.ENVIRONMENT ?? "") ? ctx.env.ENVIRONMENT! : "unknown",
      snapshot: { ...snapshot, events: snapshot.events.map((e) => ({ event: safeEvent(e.event), count: e.count })), recentEvents: snapshot.recentEvents.map((e) => ({ event: safeEvent(e.event), created_at: e.created_at })) },
      applications: INFAIX_APPS.map((app) => ({ ...app, health: "unknown", version: null, latencyMs: null })),
    };
    return Response.json(body, { headers });
  } catch {
    return Response.json({ error: { code: "METRICS_UNAVAILABLE", message: "Operations data is unavailable. Please retry." } }, { status: 503, headers });
  }
}
