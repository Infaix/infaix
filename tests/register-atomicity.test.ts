import { describe, expect, it } from "vitest";
import { PRIVACY_VERSION, TERMS_VERSION } from "../src/lib/legal-versions";
import { handleRegister } from "../worker/auth/handlers";
import { D1Store } from "../worker/auth/store";
import type { LegalAcceptanceRow, UserRow, VerificationRow } from "../worker/auth/types";
import { makeWorld, post, seedInvite } from "./helpers";
import { sqliteD1, type Sqlite } from "./sqlite-d1";

const PW = "Correct-Horse-99-Battery";

function user(id = "usr_1", email = "ada@infaix.com"): UserRow {
  return {
    id,
    email,
    password_hash: "hash",
    display_name: "Ada",
    role: "USER",
    status: "PENDING_VERIFICATION",
    email_verified: 0,
    ai_access: 0,
    created_at: 1,
    updated_at: 1,
    last_login_at: null,
  };
}

function acceptance(id = "lac_1", userId = "usr_1"): LegalAcceptanceRow {
  return {
    id,
    user_id: userId,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    source: "registration",
    accepted_at: 1,
  };
}

function verification(userId = "usr_1", id = "evf_1"): VerificationRow {
  return { id, user_id: userId, token_hash: `hash-${id}`, status: "PENDING", created_at: 1, expires_at: 100, used_at: null };
}

function openDatabase(applyAcceptanceSchema: boolean) {
  const { db, binding } = sqliteD1(["0001_init.sql", "0002_ai_access.sql", ...(applyAcceptanceSchema ? ["0005_legal_acceptance.sql"] : [])]);
  return { db, binding, store: new D1Store(binding) };
}

function count(db: Sqlite, table: "users" | "legal_acceptances"): number {
  return Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
}

describe("registration account and legal acceptance", () => {
  it("a D1 invitation race leaves no losing account or orphan records", async () => {
    const { db, store } = openDatabase(true);
    try {
      const inv = { id: "inv_1", token_hash: "invite-hash", status: "PENDING" as const, intended_email: null, role: "USER" as const, inviter_user_id: null, created_at: 1, expires_at: 100, used_at: null, used_by_user_id: null, revoked_at: null, note: null };
      await store.insertInvitation(inv);
      const results = await Promise.allSettled([
        store.registerAccount(user(), acceptance(), verification(), inv),
        store.registerAccount(user("usr_2", "bea@infaix.com"), acceptance("lac_2", "usr_2"), verification("usr_2", "evf_2"), inv),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(count(db, "users")).toBe(1);
      expect(count(db, "legal_acceptances")).toBe(1);
      expect(db.prepare("SELECT COUNT(*) AS n FROM email_verifications").get()).toMatchObject({ n: 1 });
      expect(db.prepare("SELECT status, used_by_user_id FROM invitations").get()).toMatchObject({ status: "USED", used_by_user_id: "usr_1" });
    } finally { db.close(); }
  });

  it("an acceptance SQL failure leaves the invitation pending and all registration rows absent", async () => {
    const { db, store } = openDatabase(true);
    try {
      const inv = { id: "inv_1", token_hash: "invite-hash", status: "PENDING" as const, intended_email: null, role: "USER" as const, inviter_user_id: null, created_at: 1, expires_at: 100, used_at: null, used_by_user_id: null, revoked_at: null, note: null };
      await store.insertInvitation(inv);
      db.exec("CREATE TRIGGER reject_acceptance BEFORE INSERT ON legal_acceptances BEGIN SELECT RAISE(ABORT, 'acceptance write failed'); END");
      await expect(store.registerAccount(user(), acceptance(), verification(), inv)).rejects.toThrow("acceptance write failed");
      expect(count(db, "users")).toBe(0);
      expect(count(db, "legal_acceptances")).toBe(0);
      expect(db.prepare("SELECT status FROM invitations").get()).toMatchObject({ status: "PENDING" });
      expect(db.prepare("SELECT COUNT(*) AS n FROM email_verifications").get()).toMatchObject({ n: 0 });
    } finally { db.close(); }
  });

  it("rolls back account, acceptance and invitation when verification insertion fails", async () => {
    const { db, store } = openDatabase(true);
    try {
      db.exec("CREATE TRIGGER reject_verification BEFORE INSERT ON email_verifications BEGIN SELECT RAISE(ABORT, 'verification write failed'); END");
      const inv = { id: "inv_1", token_hash: "invite-hash", status: "PENDING" as const, intended_email: null, role: "USER" as const, inviter_user_id: null, created_at: 1, expires_at: 100, used_at: null, used_by_user_id: null, revoked_at: null, note: null };
      await store.insertInvitation(inv);
      await expect(store.registerAccount(user(), acceptance(), verification(), inv)).rejects.toThrow("verification write failed");
      expect(count(db, "users")).toBe(0);
      expect(count(db, "legal_acceptances")).toBe(0);
      expect(db.prepare("SELECT status FROM invitations WHERE id = ?").get("inv_1")).toMatchObject({ status: "PENDING" });
      expect(db.prepare("SELECT COUNT(*) AS n FROM email_verifications").get()).toMatchObject({ n: 0 });
    } finally { db.close(); }
  });

  it("commits the verification token with the account and acceptance", async () => {
    const { db, store } = openDatabase(true);
    try {
      await store.registerAccount(user(), acceptance(), verification());
      expect(await store.getVerificationByTokenHash("hash-evf_1")).toMatchObject({ user_id: "usr_1", status: "PENDING" });
    } finally { db.close(); }
  });

  it("one invitation race creates exactly one account, acceptance and verification", async () => {
    const w = makeWorld();
    const { token } = await seedInvite(w);
    const results = await Promise.all(["ada@infaix.com", "bea@infaix.com"].map((email) => handleRegister(w.ctx, post("/api/auth/register", { token, email, password: PW, displayName: "Fixture" }))));
    expect(results.map((r) => r.status).sort()).toEqual([201, 410]);
    expect(w.store.users.size).toBe(1);
    expect(w.store.legalAcceptances).toHaveLength(1);
    expect(w.store.verifications.size).toBe(1);
    const winner = [...w.store.users.values()][0];
    expect(w.store.legalAcceptances[0].user_id).toBe(winner.id);
    expect([...w.store.verifications.values()][0].user_id).toBe(winner.id);
  });

  it("concurrent duplicate email registration leaves one complete account", async () => {
    const w = makeWorld();
    const payload = { email: "ada@infaix.com", password: PW, displayName: "Ada" };
    const results = await Promise.all([handleRegister(w.ctx, post("/api/auth/register", payload)), handleRegister(w.ctx, post("/api/auth/register", payload))]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(w.store.users.size).toBe(1);
    expect(w.store.legalAcceptances).toHaveLength(1);
    expect(w.store.verifications.size).toBe(1);
  });
  it("creates the user and the acceptance together", async () => {
    const w = makeWorld();
    const res = await handleRegister(w.ctx, post("/api/auth/register", {
      email: "ada@infaix.com",
      password: PW,
      displayName: "Ada",
      role: "OWNER",
      ai_access: 1,
      newsletterSubscribed: true,
    }));
    expect(res.status).toBe(201);
    const created = (res.body as { user: { id: string; role: string; ai_access: boolean } }).user;
    expect(created.role).toBe("USER");
    expect(created.ai_access).toBe(false);
    const row = await w.store.getUserById(created.id);
    expect(row?.role).toBe("USER");
    expect(row?.ai_access).toBe(0);
    expect(await w.store.listLegalAcceptancesForUser(created.id)).toHaveLength(1);
    expect(await w.store.getNewsletterByEmail("ada@infaix.com")).toBeNull();
  });

  it("creates neither row when the acceptance write fails", async () => {
    const w = makeWorld();
    w.store.acceptanceWriteError = new Error("acceptance write failed");
    const res = await handleRegister(w.ctx, post("/api/auth/register", {
      email: "ada@infaix.com",
      password: PW,
      displayName: "Ada",
    }));
    expect(res.status).toBe(500);
    expect(await w.store.getUserByEmail("ada@infaix.com")).toBeNull();
    expect(w.store.legalAcceptances).toHaveLength(0);
    expect(await w.store.getNewsletterByEmail("ada@infaix.com")).toBeNull();
  });

  it("creates neither row when the legal-acceptance schema is missing", async () => {
    const w = makeWorld();
    w.store.legalSchemaReady = false;
    const res = await handleRegister(w.ctx, post("/api/auth/register", {
      email: "ada@infaix.com",
      password: PW,
      displayName: "Ada",
    }));
    expect(res.status).toBe(500);
    expect(await w.store.getUserByEmail("ada@infaix.com")).toBeNull();
    expect(w.store.legalAcceptances).toHaveLength(0);
  });

  it("does not add a partial row when the email is already registered", async () => {
    const w = makeWorld();
    const first = await handleRegister(w.ctx, post("/api/auth/register", {
      email: "ada@infaix.com",
      password: PW,
      displayName: "Ada",
    }));
    expect(first.status).toBe(201);
    const second = await handleRegister(w.ctx, post("/api/auth/register", {
      email: "ada@infaix.com",
      password: PW,
      displayName: "Ada",
    }));
    expect(second.status).toBe(409);
    expect(w.store.users.size).toBe(1);
    expect(w.store.legalAcceptances).toHaveLength(1);
    expect(await w.store.getNewsletterByEmail("ada@infaix.com")).toBeNull();
  });

  it("rolls the user insert back in the database batch when acceptance fails", async () => {
    const ready = openDatabase(true);
    try {
      await ready.store.registerAccount(user(), acceptance(), verification());
      expect(count(ready.db, "users")).toBe(1);
      expect(count(ready.db, "legal_acceptances")).toBe(1);
      const stored = await ready.store.getUserById("usr_1");
      expect(stored?.role).toBe("USER");
      expect(stored?.ai_access).toBe(0);

      await expect(ready.store.registerAccount(user("usr_2", "bea@infaix.com"), acceptance("lac_2", "missing-user"), verification("usr_2", "evf_2"))).rejects.toThrow();
      expect(count(ready.db, "users")).toBe(1);
      expect(count(ready.db, "legal_acceptances")).toBe(1);

      await expect(ready.store.registerAccount(user("usr_3", "ada@infaix.com"), acceptance("lac_3", "usr_3"), verification("usr_3", "evf_3"))).rejects.toThrow();
      expect(count(ready.db, "users")).toBe(1);
      expect(count(ready.db, "legal_acceptances")).toBe(1);
    } finally {
      ready.db.close();
    }

    const missing = openDatabase(false);
    try {
      await expect(missing.store.registerAccount(user(), acceptance(), verification())).rejects.toThrow();
      expect(count(missing.db, "users")).toBe(0);
    } finally {
      missing.db.close();
    }
  });
});
