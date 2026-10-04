import { describe, expect, it } from "vitest";
import { D1Store } from "../worker/auth/store";
import { handleApi } from "../worker/auth/router";
import { sqliteD1 } from "./sqlite-d1";
import { makeWorld } from "./helpers";
import { createSession } from "../worker/auth/sessions";

// Node 24's built-in SQLite exercises the actual SQL and schema without a
// network, additional package, or local/remote D1 data. Node 20 types do not
// declare this newer runtime API, so describe only the test adapter surface.
function database() {
  const { db, binding } = sqliteD1(["0001_init.sql", "0002_ai_access.sql", "0003_conversations.sql"]);
  return { db, binding, store: new D1Store(binding) };
}

describe("operations SQL against the real migrations", () => {
  it("counts all users, excludes disabled/expired sessions and buckets half-open windows", async () => {
    const { db, store } = database();
    try {
      for (let i = 0; i < 205; i++) await store.insertUser({ id: `user-${i}`, email: `test-${i}@example.invalid`, password_hash: "not-a-secret", display_name: "Fixture", role: "USER", status: i === 0 ? "DISABLED" : "ACTIVE", ai_access: 0, email_verified: 1, created_at: i < 200 ? 0 : 150, updated_at: 0, last_login_at: null });
      for (const [id, user_id, expires_at] of [["disabled", "user-0", 400], ["expired", "user-1", 200], ["active", "user-2", 400]] as const) await store.insertSession({ id, user_id, expires_at, created_at: 0, last_seen_at: 0, ip: null, user_agent: null });
      for (const created_at of [99, 100, 149, 150, 199, 200]) await store.insertAudit({ event: "LOGIN_FAILURE", created_at, actor_user_id: null, target_user_id: null, ip: "private", detail: "private" });
      const snapshot = await store.operationsSnapshot(100, 200, 50);
      expect(snapshot.totalUsers).toBe(205);
      expect(snapshot.recentUsers).toBe(5);
      expect(snapshot.activeSessions).toBe(1);
      expect(snapshot.events).toEqual([{ event: "LOGIN_FAILURE", count: 4 }]);
      expect(snapshot.activity).toEqual([{ bucket: 0, count: 2 }, { bucket: 1, count: 2 }]);
      expect(snapshot.recentEvents.map((e) => e.created_at)).toEqual([199, 150, 149, 100]);
      expect(JSON.stringify(snapshot)).not.toContain("private");
    } finally { db.close(); }
  });
  it("routes the real endpoint through authorization and SQL", async () => {
    const { db, binding, store } = database();
    try {
      const w = makeWorld({ INFAIX_DB: binding });
      const now = Date.now();
      await store.insertUser({ id: "owner", email: "fixture@example.invalid", password_hash: "private", display_name: "Fixture", role: "OWNER", status: "ACTIVE", ai_access: 0, email_verified: 1, created_at: now - 1000, updated_at: now, last_login_at: null });
      const session = await createSession({ ...w.ctx, store, now: () => now }, "owner");
      const url = new URL("https://infaix.com/api/admin/operations?range=24H");
      const anonymous = await handleApi(new Request(url), w.ctx.env, url);
      expect(anonymous?.status).toBe(401);
      const response = await handleApi(new Request(url, { headers: { cookie: session!.setCookie.split(";")[0] } }), w.ctx.env, url);
      expect(response?.status).toBe(200);
      expect(response).toBeInstanceOf(Response);
      const body = await (response as Response).json() as { snapshot: { totalUsers: number } };
      expect(body.snapshot.totalUsers).toBe(1);
    } finally { db.close(); }
  });
});
