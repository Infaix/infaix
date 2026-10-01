import { describe, expect, it, vi } from "vitest";
import { requestMetadata, routeLabel } from "../worker/telemetry";
import worker from "../worker/index";
import { makeWorld } from "./helpers";

describe("privacy-preserving request metadata", () => {
  it("drops bodies, queries, credentials and path identifiers", () => {
    const req = new Request("https://infaix.com/api/ai/conversations/private-conversation?token=private-token", { method: "POST", headers: { authorization: "Bearer private-token", cookie: "secret-cookie" }, body: "private-message" });
    const metadata = requestMetadata(req, 403, 10, 40);
    expect(metadata.route).toBe("/api/ai/conversations/:id");
    expect(metadata.latency_ms).toBe(30);
    for (const value of ["private-conversation", "private-token", "secret-cookie", "private-message"]) expect(JSON.stringify(metadata)).not.toContain(value);
    expect(routeLabel("/api/arbitrary-sensitive-path")).toBe("/api/other");
  });
  it("records API failures without exporting exception messages", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await worker.fetch(new Request("https://infaix.com/api/admin/operations?secret=hidden"), makeWorld().ctx.env, { waitUntil() {} });
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ service: "core", status: 503, route: "/api/admin/operations", error_code: "SERVER_ERROR" });
    expect(log.mock.calls[0][0]).not.toContain("hidden");
    log.mockRestore();
  });
});
