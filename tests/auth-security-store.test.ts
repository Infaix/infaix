import { afterEach, describe, expect, it, vi } from "vitest";
import { abuseDigest } from "../worker/auth/abuse";
import { D1SecurityStore } from "../worker/auth/security-store";
import { sqliteD1 } from "./sqlite-d1";

const BASE = ["0001_init.sql", "0002_ai_access.sql", "0003_conversations.sql", "0004_public_identity.sql", "0005_legal_acceptance.sql"];
const NOW = 3_600_000;
const HOUR = 3_600_000;
const TTL = 172_800_000;
const env = { AUTH_ABUSE_HASH_SECRET: "unit-test-only-secret-material-000000000" };
const disposables: (() => void)[] = [];
afterEach(() => { for (const close of disposables.splice(0)) close(); vi.useRealTimers(); });
async function setup(migrated = true) {
  const sql = sqliteD1(migrated ? [...BASE, "0006_auth_security.sql"] : BASE);
  disposables.push(() => sql.db.close());
  return {
    ...sql, a: new D1SecurityStore(sql.binding), b: new D1SecurityStore(sql.binding),
    scope: await abuseDigest(env, "login-email", "private@infaix.com"),
    email: await abuseDigest(env, "email-send", "private@infaix.com"),
  };
}

describe("atomic fixed-window counters", () => {
  it("returns the count from each mutation and derives admission from it", async () => {
    const { a, scope } = await setup();
    expect(await a.hitAttempt(scope, { limit: 2, windowSeconds: 60 }, NOW)).toMatchObject({ allowed: true, count: 1, retryAfter: 0 });
    expect(await a.hitAttempt(scope, { limit: 2, windowSeconds: 60 }, NOW + 1)).toMatchObject({ allowed: true, count: 2 });
    expect(await a.hitAttempt(scope, { limit: 2, windowSeconds: 60 }, NOW + 1000)).toMatchObject({ allowed: false, count: 3, reason: "LIMIT", retryAfter: 59 });
  });
  it("starts a new fixed window at its exact boundary and separates window durations", async () => {
    const { a, scope, db } = await setup();
    await a.hitAttempt(scope, { limit: 1, windowSeconds: 60 }, NOW + 59_999);
    expect(await a.hitAttempt(scope, { limit: 1, windowSeconds: 60 }, NOW + 60_000)).toMatchObject({ allowed: true, count: 1 });
    expect(await a.hitAttempt(scope, { limit: 1, windowSeconds: 3600 }, NOW)).toMatchObject({ allowed: true, count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM auth_attempt_windows").get()).toEqual({ n: 3 });
  });
  it("shares concurrent increments across two instances without lost updates", async () => {
    const { a, b, scope, db } = await setup();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).hitAttempt(scope, { limit: 10, windowSeconds: 60 }, NOW)));
    expect(results.map((r) => "count" in r ? r.count : -1).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(db.prepare("SELECT count FROM auth_attempt_windows").get()).toEqual({ count: 20 });
  });
  it("does not let an expired row remain authoritative when cleanup is delayed", async () => {
    const { a, scope, db } = await setup();
    await a.hitAttempt(scope, { limit: 1, windowSeconds: 60 }, NOW);
    db.prepare("UPDATE auth_attempt_windows SET count=999, expires_at=?").run(NOW);
    expect(await a.hitAttempt(scope, { limit: 1, windowSeconds: 60 }, NOW)).toMatchObject({ allowed: true, count: 1 });
    expect(db.prepare("SELECT expires_at FROM auth_attempt_windows").get()).toEqual({ expires_at: NOW + TTL });
  });
  it("fails closed with missing schema without exposing SQL errors", async () => {
    const { a, scope } = await setup(false);
    const result = await a.hitAttempt(scope, { limit: 1, windowSeconds: 60 }, NOW);
    expect(result).toEqual({ allowed: false, reason: "UNAVAILABLE", retryAfter: 60 });
    expect(JSON.stringify(result)).not.toMatch(/table|SQL|private@/);
  });
  it("fails closed when D1 throws after a previously valid admission", async () => {
    const { a, scope, db } = await setup();
    await a.hitAttempt(scope, { limit: 2, windowSeconds: 60 }, NOW);
    db.exec("DROP TABLE auth_attempt_windows");
    expect(await a.hitAttempt(scope, { limit: 2, windowSeconds: 60 }, NOW)).toEqual({ allowed: false, reason: "UNAVAILABLE", retryAfter: 60 });
  });
});

describe("atomic shared email send admission", () => {
  it("issues one random reservation, stores only a digest and blocks immediate retry", async () => {
    const { a, b, email, db } = await setup();
    const first = await a.reserveEmailSend(email, "verification", NOW);
    expect(first).toMatchObject({ allowed: true, reason: "ALLOWED", retryAfter: 0, reservationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    const before = db.prepare("SELECT * FROM auth_email_send_admission").get();
    const denied = await b.reserveEmailSend(email, "recovery", NOW);
    expect(denied).toEqual({ allowed: false, reason: "COOLDOWN", retryAfter: 60 });
    expect(db.prepare("SELECT * FROM auth_email_send_admission").get()).toEqual(before);
    expect(JSON.stringify(before)).not.toContain("private@infaix.com");
    expect(before).toMatchObject({ total_count: 1, verification_count: 1, recovery_count: 0, expires_at: NOW + TTL });
  });
  it("allows after exactly 60 seconds with a different winning reservation", async () => {
    const { a, b, email, db } = await setup();
    const first = await a.reserveEmailSend(email, "verification", NOW);
    const second = await b.reserveEmailSend(email, "recovery", NOW + 60_000);
    expect(second.allowed).toBe(true);
    expect("reservationId" in second && second.reservationId).not.toBe("reservationId" in first && first.reservationId);
    expect(db.prepare("SELECT total_count,verification_count,recovery_count FROM auth_email_send_admission").get()).toEqual({ total_count: 2, verification_count: 1, recovery_count: 1 });
  });
  it("enforces the combined five/hour budget across purposes", async () => {
    const { a, email } = await setup();
    for (let i = 0; i < 5; i++) expect((await a.reserveEmailSend(email, i % 2 ? "recovery" : "verification", NOW + i * 60_000)).allowed).toBe(true);
    expect(await a.reserveEmailSend(email, "recovery", NOW + 300_000)).toEqual({ allowed: false, reason: "COMBINED_LIMIT", retryAfter: 3300 });
    expect((await a.reserveEmailSend(email, "recovery", NOW + HOUR)).allowed).toBe(true);
  });
  it.each(["verification", "recovery"] as const)("enforces the independent three/hour %s cap", async (purpose) => {
    const { a, email } = await setup();
    for (let i = 0; i < 3; i++) expect((await a.reserveEmailSend(email, purpose, NOW + i * 60_000)).allowed).toBe(true);
    expect(await a.reserveEmailSend(email, purpose, NOW + 180_000)).toEqual({ allowed: false, reason: "PURPOSE_LIMIT", retryAfter: 3420 });
    expect((await a.reserveEmailSend(email, purpose === "verification" ? "recovery" : "verification", NOW + 180_000)).allowed).toBe(true);
  });
  it("has exactly one cross-instance winner under concurrency and preserves its id", async () => {
    const { a, b, email, db } = await setup();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).reserveEmailSend(email, i % 2 ? "recovery" : "verification", NOW)));
    const winners = results.filter((r) => r.allowed);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => !r.allowed).every((r) => !("reservationId" in r))).toBe(true);
    expect(db.prepare("SELECT reservation_id,total_count FROM auth_email_send_admission").get()).toEqual({ reservation_id: "reservationId" in winners[0] ? winners[0].reservationId : null, total_count: 1 });
  });
  it("does not reset the shared cooldown at the hourly boundary", async () => {
    const { a, email } = await setup();
    await a.reserveEmailSend(email, "verification", NOW + HOUR - 1000);
    expect(await a.reserveEmailSend(email, "recovery", NOW + HOUR)).toEqual({ allowed: false, reason: "COOLDOWN", retryAfter: 59 });
    expect((await a.reserveEmailSend(email, "recovery", NOW + HOUR + 59_000)).allowed).toBe(true);
  });
  it("ignores expired quotas and cooldowns without depending on cleanup", async () => {
    const { a, email, db } = await setup();
    await a.reserveEmailSend(email, "verification", NOW);
    db.prepare("UPDATE auth_email_send_admission SET total_count=5,verification_count=3,recovery_count=2,cooldown_until=?,expires_at=?").run(NOW + HOUR, NOW);
    expect((await a.reserveEmailSend(email, "recovery", NOW)).allowed).toBe(true);
    expect(db.prepare("SELECT total_count,verification_count,recovery_count,expires_at FROM auth_email_send_admission").get()).toEqual({ total_count: 1, verification_count: 0, recovery_count: 1, expires_at: NOW + TTL });
  });
  it("fails closed for missing schema and database failures", async () => {
    const { a, email } = await setup(false);
    expect(await a.reserveEmailSend(email, "verification", NOW)).toEqual({ allowed: false, reason: "UNAVAILABLE", retryAfter: 60 });
    const ready = await setup();
    ready.db.exec("DROP TABLE auth_email_send_admission");
    expect(await ready.a.reserveEmailSend(ready.email, "recovery", NOW)).toEqual({ allowed: false, reason: "UNAVAILABLE", retryAfter: 60 });
  });
});

describe("bounded isolate cleanup", () => {
  it("removes at most 500 expired rows across both tables and guards all instances for a minute", async () => {
    const { a, b, db } = await setup();
    for (let i = 0; i < 300; i++) {
      const digest = i.toString(16).padStart(64, "0");
      db.prepare("INSERT INTO auth_attempt_windows VALUES (?,0,60,1,?)").run(digest, NOW);
      db.prepare("INSERT INTO auth_email_send_admission VALUES (?,0,1,1,0,0,'id',?)").run(digest, NOW);
    }
    db.prepare("INSERT INTO auth_attempt_windows VALUES (?,0,60,1,?)").run("f".repeat(64), NOW + 1);
    expect(await a.pruneExpired(NOW)).toEqual({ ran: true, ok: true, deleted: 500 });
    expect(await b.pruneExpired(NOW)).toEqual({ ran: false, ok: true, deleted: 0 });
    expect(await a.pruneExpired(NOW + 59_999)).toEqual({ ran: false, ok: true, deleted: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM auth_attempt_windows").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM auth_email_send_admission").get()).toEqual({ n: 100 });
    expect(await b.pruneExpired(NOW + 60_000)).toEqual({ ran: true, ok: true, deleted: 101 });
  });
  it("uses expiry indexes for selecting bounded expired rows", async () => {
    const { db } = await setup();
    for (const table of ["auth_attempt_windows", "auth_email_send_admission"]) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT * FROM ${table} WHERE expires_at <= ? ORDER BY expires_at LIMIT 500`).all(NOW);
      expect(JSON.stringify(plan)).toMatch(/USING INDEX idx_auth_/);
    }
  });
  it("returns safe cleanup failure and does not grant admission with absent schema", async () => {
    const { a, scope } = await setup(false);
    expect(await a.pruneExpired(NOW + 120_000)).toEqual({ ran: true, ok: false, deleted: 0 });
    expect((await a.hitAttempt(scope, { limit: 10, windowSeconds: 60 }, NOW)).allowed).toBe(false);
  });
});
