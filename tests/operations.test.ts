import { describe, expect, it, vi } from "vitest";
import { handleOperations } from "../worker/operations";
import { get, makeWorld, registerVerifyLogin } from "./helpers";
import type { Role } from "../worker/auth/types";
import type { OperationsResponse } from "../src/lib/operations-contract";

async function fixture(role: Role = "OWNER") {
  const w = makeWorld();
  const user = await registerVerifyLogin(w);
  await w.store.updateUser(user.userId, { role, updated_at: w.getNow() });
  w.advance(1);
  return { w, user };
}

describe("operations authorization and privacy", () => {
  it("rejects anonymous and bootstrap-token access before reading metrics", async () => {
    const w = makeWorld({ ADMIN_BOOTSTRAP_TOKEN: "test-bootstrap-token" });
    const read = vi.spyOn(w.store, "operationsSnapshot");
    const req = new Request("https://infaix.com/api/admin/operations", { headers: { "x-admin-token": "test-bootstrap-token" } });
    const response = await handleOperations(w.ctx, req);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(read).not.toHaveBeenCalled();
  });
  it.each<Role>(["USER", "ADMIN", "OWNER"])("enforces %s role on the server", async (role) => {
    const { w, user } = await fixture(role);
    const response = await handleOperations(w.ctx, get("/api/admin/operations", user.cookie));
    expect(response.status).toBe(role === "USER" ? 403 : 200);
  });
  it("rejects disabled owners and expired sessions", async () => {
    const { w, user } = await fixture();
    await w.store.updateUser(user.userId, { status: "DISABLED", updated_at: w.getNow() });
    expect((await handleOperations(w.ctx, get("/api/admin/operations", user.cookie))).status).toBe(401);
    await w.store.updateUser(user.userId, { status: "ACTIVE", updated_at: w.getNow() });
    w.advance(31 * 86400000);
    expect((await handleOperations(w.ctx, get("/api/admin/operations", user.cookie))).status).toBe(401);
  });
  it("returns only safe event fields and separates lifecycle from unknown health", async () => {
    const { w, user } = await fixture();
    w.store.audits.push({ event: "sensitive-unknown-event", detail: "secret-detail", ip: "private-ip", actor_user_id: "private-actor", target_user_id: null, created_at: w.getNow() - 1 });
    const res = await handleOperations(w.ctx, get("/api/admin/operations?range=1H", user.cookie));
    const body = await res.json() as OperationsResponse;
    expect(body.snapshot.totalUsers).toBe(1);
    expect(body.snapshot.activeSessions).toBe(1);
    expect(body.applications.every((a) => a.health === "unknown" && a.version === null && a.latencyMs === null)).toBe(true);
    expect(body.snapshot.recentEvents.some((e) => e.event === "OTHER_EVENT")).toBe(true);
    const text = JSON.stringify(body);
    for (const secret of ["secret-detail", "private-ip", "private-actor", "sensitive-unknown-event", user.email, "password_hash", "SESSION_SECRET"]) expect(text).not.toContain(secret);
  });
  it("rejects invalid and inherited range names", async () => {
    const { w, user } = await fixture();
    for (const range of ["all", "__proto__", "toString", "100D"]) expect((await handleOperations(w.ctx, get(`/api/admin/operations?range=${range}`, user.cookie))).status).toBe(400);
  });
  it("supports all bounded ranges and filters events by time", async () => {
    const { w, user } = await fixture();
    w.store.audits = [{ event: "LOGIN_FAILURE", actor_user_id: null, target_user_id: null, ip: null, detail: null, created_at: w.getNow() - 2 * 3600000 }];
    for (const range of ["1H", "6H", "24H", "7D", "30D"]) {
      const body = await (await handleOperations(w.ctx, get(`/api/admin/operations?range=${range}`, user.cookie))).json() as OperationsResponse;
      expect(body.snapshot.recentEvents.length).toBe(range === "1H" ? 0 : 1);
    }
  });
  it("reports storage failure as unavailable, never as zero", async () => {
    const { w, user } = await fixture();
    vi.spyOn(w.store, "operationsSnapshot").mockRejectedValue(new Error("private-db-error"));
    const res = await handleOperations(w.ctx, get("/api/admin/operations", user.cookie));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("private-db-error");
  });
  it("rate limits authenticated metric reads", async () => {
    const { w, user } = await fixture();
    const window = Math.floor(w.getNow() / 60000) * 60000;
    for (let i = 0; i < 60; i++) await w.store.hitRateLimit(`operations:${user.userId}`, window);
    expect((await handleOperations(w.ctx, get("/api/admin/operations", user.cookie))).status).toBe(429);
  });
});
