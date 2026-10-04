import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sqliteD1 } from "./sqlite-d1";

export const SECURITY_BASE_MIGRATIONS = ["0001_init.sql", "0002_ai_access.sql", "0003_conversations.sql", "0004_public_identity.sql", "0005_legal_acceptance.sql"];

describe("0006 additive auth security migration", () => {
  it("preserves legacy rows and adds nullable continuation, private counters and expiry indexes", () => {
    const path = new URL("../db/migrations/0006_auth_security.sql", import.meta.url);
    expect(existsSync(path)).toBe(true);
    const { db } = sqliteD1(SECURITY_BASE_MIGRATIONS);
    try {
      db.exec("INSERT INTO users (id,email,password_hash,display_name,role,status,email_verified,created_at,updated_at) VALUES ('legacy','legacy@example.com','hash','Legacy','USER','PENDING_VERIFICATION',0,1,1)");
      db.exec("INSERT INTO email_verifications (id,user_id,token_hash,status,created_at,expires_at) VALUES ('ev','legacy','token-hash','PENDING',1,100)");
      const oldTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
      db.exec(readFileSync(path, "utf8"));
      expect(db.prepare("SELECT email FROM users WHERE id='legacy'").get()).toEqual({ email: "legacy@example.com" });
      expect(db.prepare("SELECT continuation FROM email_verifications WHERE id='ev'").get()).toEqual({ continuation: null });
      db.exec("UPDATE email_verifications SET continuation='/account' WHERE id='ev'");
      expect(db.prepare("SELECT continuation FROM email_verifications WHERE id='ev'").get()).toEqual({ continuation: "/account" });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
      for (const table of oldTables) expect(tables).toContainEqual(table);
      expect(tables).toContainEqual({ name: "auth_attempt_windows" });
      expect(tables).toContainEqual({ name: "auth_email_send_admission" });
      const columns = db.prepare("PRAGMA table_info(auth_attempt_windows)").all() as { name: string; pk: number }[];
      expect(columns.map((c) => c.name)).toEqual(["scope_digest", "window_start", "window_seconds", "count", "expires_at"]);
      expect(columns.filter((c) => c.pk).map((c) => c.name)).toEqual(["scope_digest", "window_start", "window_seconds"]);
      expect((db.prepare("PRAGMA table_info(auth_email_send_admission)").all() as { name: string }[]).map((c) => c.name)).toEqual([
        "email_digest", "window_start", "total_count", "verification_count", "recovery_count", "cooldown_until", "reservation_id", "expires_at",
      ]);
      for (const table of ["auth_attempt_windows", "auth_email_send_admission"]) {
        const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[];
        expect(indexes.some((idx) => (db.prepare(`PRAGMA index_info(${idx.name})`).all() as { name: string }[]).some((col) => col.name === "expires_at"))).toBe(true);
      }
    } finally { db.close(); }
  });
});
