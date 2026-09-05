// Creates a one-time invitation WITHOUT storing or logging the raw token.
// Usage:
//   node scripts/new-invite.mjs --email ada@infaix.com [--role ADMIN] [--ttl-hours 72] [--note "Founding member"]
//
// Prints:
//   1. the SQL to insert the invitation row (token stored as SHA-256 only)
//   2. the registration URL containing the raw token (deliver once, then delete)
// Apply with:
//   wrangler d1 execute infaix-db --command="<SQL>"
import { randomBytes, createHash } from "node:crypto";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const email = (arg("email", "") || "").trim().toLowerCase();
const role = (arg("role", "USER") || "USER").toUpperCase();
const ttlHours = Math.min(Math.max(Number(arg("ttl-hours", "72")) || 72, 1), 24 * 30);
const note = (arg("note", "") || "").slice(0, 200);

if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
  console.error("Provide --email <address>.");
  process.exit(1);
}
if (!["OWNER", "ADMIN", "USER"].includes(role)) {
  console.error("Role must be OWNER, ADMIN, or USER.");
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
const id = `inv_${randomBytes(12).toString("hex")}`;
const now = Date.now();
const expires = now + ttlHours * 60 * 60 * 1000;
const esc = (s) => `'${s.replace(/'/g, "''")}'`;

const sql =
  `INSERT INTO invitations (id, token_hash, status, intended_email, role, inviter_user_id, created_at, expires_at, used_at, used_by_user_id, revoked_at, note) VALUES ` +
  `(${esc(id)}, ${esc(tokenHash)}, 'PENDING', ${esc(email)}, ${esc(role)}, NULL, ${now}, ${expires}, NULL, NULL, NULL, ${note ? esc(note) : "NULL"});`;

console.log("--- SQL (run via: wrangler d1 execute infaix-db --command=\"<SQL>\") ---");
console.log(sql);
console.log("--- Registration URL (deliver ONCE to the invitee, then delete) ---");
console.log(`https://infaix.com/register?token=${token}`);
console.log("--- Invitation id (for revocation: POST /api/admin/invites/<id>/revoke) ---");
console.log(id);
