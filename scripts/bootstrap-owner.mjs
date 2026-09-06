// INFAIX one-time owner bootstrap (operator command, local execution only).
//
// Establishes the single OWNER account through the EXISTING auth API —
// invite (ADMIN_BOOTSTRAP_TOKEN workflow) -> register -> verify -> login.
// No new HTTP endpoints, no schema changes, no second auth system.
//
//   npm run auth:bootstrap-owner [-- --origin http://localhost:8787]
//   node scripts/bootstrap-owner.mjs --target production --origin https://infaix.com --confirm-production
//
// Security contract:
// - Target email/role are FIXED constants. --email/--role/--password args
//   are refused (argv leaks into history/process listings; arbitrary
//   promotion must be impossible).
// - Passwords come from an interactive no-echo prompt or the optional
//   INFAIX_OWNER_PASSWORD env var. Values are never printed, logged, or
//   stored — they travel only inside HTTPS/localhost API request bodies and
//   are hashed server-side by the existing PBKDF2 implementation.
// - The script NEVER executes D1 SQL itself. An optional, strictly-guarded
//   finalize statement is PRINTED for the operator to run via
//   `wrangler d1 execute` only after email ownership is confirmed.
// - Production requires --confirm-production plus interactive CONFIRM.
// - Existing accounts are never overwritten: a spent/taken invitation ends
//   the run with zero changes and a safe-state report.
import { createInterface } from "node:readline";

// Fixed bootstrap identity. Not configurable by design (§6: no arbitrary
// owner email, no arbitrary role assignment).
const OWNER_EMAIL = "cewetzels@outlook.com";
const OWNER_DISPLAY_NAME = "Infaix";
const OWNER_ROLE = "OWNER";

const argv = process.argv.slice(2);

function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
}
function flag(name) {
  return argv.includes(`--${name}`);
}

function usage(exit = 0) {
  console.log(`INFAIX owner bootstrap — one-time OWNER establishment via the existing auth API.

Usage:
  npm run auth:bootstrap-owner [-- --origin <url>] [--invite-token <t>] [--verify-token <t>]
  node scripts/bootstrap-owner.mjs --target production --origin https://infaix.com --confirm-production

Targets:
  --target local|production      default: local (refuses production surprises)
  --origin <url>                 default per target (local: http://localhost:8787)
  --confirm-production           required for production, plus interactive CONFIRM

Resume/optional inputs (never required up front):
  --invite-token <token>         reuse a minted OWNER invite instead of minting
  --verify-token <token>         complete email verification non-interactively

Automation (optional; interactive prompts are the default):
  INFAIX_ADMIN_TOKEN             bootstrap admin token (else prompted, no echo)
  INFAIX_OWNER_PASSWORD          owner password (else prompted twice, no echo)

Refused (by design): --email, --role, --password, --display-name.`);
  process.exit(exit);
}

if (flag("help") || flag("h")) usage(0);

// --- Refuse dangerous/configurable identity inputs -------------------------
for (const banned of ["--email", "--role", "--password", "--display-name", "--display_name"]) {
  if (argv.includes(banned) || argv.some((a) => a.startsWith(`${banned}=`))) {
    console.error(`Refused: ${banned} is not accepted. The bootstrap identity is fixed (${OWNER_EMAIL} / ${OWNER_ROLE}).`);
    process.exit(2);
  }
}

const target = (arg("target", "local") || "local").toLowerCase();
if (!["local", "production"].includes(target)) {
  console.error('Invalid --target. Use "local" or "production".');
  process.exit(2);
}
const origin = arg("origin", target === "production" ? "https://infaix.com" : "http://localhost:8787") || "";
let originUrl;
try {
  originUrl = new URL(origin);
} catch {
  console.error("Invalid --origin URL.");
  process.exit(2);
}
if (target === "production") {
  if (originUrl.protocol !== "https:") {
    console.error("Production requires an https:// --origin.");
    process.exit(2);
  }
  if (!flag("confirm-production")) {
    console.error("Refusing production without --confirm-production. Re-run with the flag after review.");
    process.exit(2);
  }
}

const inviteTokenArg = arg("invite-token", null);
const verifyTokenArg = arg("verify-token", null);

const isTTY = process.stdin.isTTY === true && process.stdout.isTTY === true;

function promptLine(query) {
  if (!isTTY) {
    console.error(`No TTY: cannot prompt for "${query.trim()}". Provide it via the documented env var or flag.`);
    process.exit(2);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

// No-echo secret prompt. Falls back to env (automation) when stdin is not a TTY.
function promptSecret(query, envName) {
  const fromEnv = envName ? process.env[envName] : undefined;
  if (fromEnv) return Promise.resolve(fromEnv);
  if (!isTTY) {
    console.error(`No TTY and ${envName} is unset. Run interactively or export ${envName}.`);
    process.exit(2);
  }
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(query);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        cleanup();
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        cleanup();
        stdout.write("\n");
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else if (ch >= " ") {
        value += ch;
      }
    };
    const cleanup = () => {
      stdin.removeListener("data", onData);
      try { stdin.setRawMode(false); } catch { /* already restored */ }
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

async function api(path, { method = "GET", body, cookie } = {}) {
  const headers = { "content-type": "application/json", origin: originUrl.origin };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${originUrl.origin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { parsed = null; }
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, body: parsed, setCookie };
}

function fail(message, hint) {
  console.error(`\nFAILED: ${message}`);
  if (hint) console.error(hint);
  process.exit(1);
}

function safeUserLine(prefix, user) {
  // Safe projection only: role/status/verification/AI grant. Never ids of
  // sessions, hashes, or tokens.
  console.log(
    `${prefix} email=${user.email} display=${user.display_name} role=${user.role} ` +
    `status=${user.status} verified=${user.email_verified} ai_access=${user.ai_access}`
  );
}

console.log("INFAIX Owner Bootstrap");
console.log(`Target: ${target} (${originUrl.origin})`);
console.log(`Email: ${OWNER_EMAIL}`);
console.log(`Display name: ${OWNER_DISPLAY_NAME}`);

if (target === "production") {
  const confirm = await promptLine('Type CONFIRM to bootstrap the OWNER on production: ');
  if (confirm.trim() !== "CONFIRM") {
    console.error("Confirmation not given. Aborting with zero changes.");
    process.exit(2);
  }
}

// --- Step 0: API sanity (anonymous /me must be 401) -------------------------
let me;
try {
  me = await api("/api/auth/me");
} catch {
  fail("API unreachable.", `Start the stack first (e.g. \`npm run build && npx wrangler dev\` for local) or check --origin.`);
}
if (me.status !== 401) {
  fail(`Unexpected API state (GET /api/auth/me -> ${me.status}, expected 401).`, "Aborting with zero changes.");
}
console.log("API check: anonymous /me correctly reports unauthenticated.");

// --- Step 1: email-locked OWNER invite (existing bootstrap workflow) --------
let inviteToken = inviteTokenArg;
if (!inviteToken) {
  const adminToken = await promptSecret("Admin bootstrap token: ", "INFAIX_ADMIN_TOKEN");
  if (!adminToken) fail("Admin bootstrap token is required to mint the OWNER invite.");
  // x-admin-token is the existing invite-scoped admin workflow (see
  // docs/auth.md); Origin satisfies the state-changing CSRF gate.
  let minted = null;
  try {
    const headers = { "content-type": "application/json", origin: originUrl.origin, "x-admin-token": adminToken };
    const res = await fetch(`${originUrl.origin}/api/admin/invites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ intendedEmail: OWNER_EMAIL, role: OWNER_ROLE, ttlHours: 72, note: "owner-bootstrap" }),
    });
    minted = { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    fail("Invite request failed (network).", "Zero changes made server-side by this step.");
  }
  if (minted.status === 403) {
    fail(
      "Bootstrap token rejected (403).",
      "The ADMIN_BOOTSTRAP_TOKEN may be unset, wrong, or already retired. Zero invitations minted."
    );
  }
  if (minted.status !== 201 || !minted.body || typeof minted.body.token !== "string") {
    fail(`Invite minting failed (status ${minted.status}).`, "Zero changes made. Resolve the admin workflow before retrying.");
  }
  if (minted.body.role !== OWNER_ROLE) fail("Invite role mismatch. Aborting with zero account changes.");
  inviteToken = minted.body.token;
  console.log("Invite minted: email-locked OWNER invitation (single-use, 72h).");
} else {
  console.log("Using provided --invite-token (not displayed).");
}

// --- Step 2: owner password (interactive, no echo) ---------------------------
let password = process.env.INFAIX_OWNER_PASSWORD || "";
if (!password) {
  password = await promptSecret("Password: ", null);
  const confirmPw = await promptSecret("Confirm password: ", null);
  if (!password || password !== confirmPw) {
    console.error("Passwords do not match or are empty. Aborting with zero changes.");
    process.exit(2);
  }
}
if (password.length < 12) {
  console.error("Password too short (minimum 12 characters per policy). Aborting with zero changes.");
  process.exit(2);
}
// From here the plaintext lives only in this process's memory and inside the
// TLS/localhost register+login request bodies. It is never printed or logged.

// --- Step 3: register through the normal invite flow -------------------------
console.log("Registering owner account (server-side PBKDF2 hashing)...");
const reg = await api("/api/auth/register", {
  method: "POST",
  body: { token: inviteToken, email: OWNER_EMAIL, displayName: OWNER_DISPLAY_NAME, password },
}).catch(() => null);
if (!reg) fail("Registration request failed (network).", "Retry once reachability is restored.");
if (reg.status === 410) {
  // Idempotent-safe path: invitation spent/taken — never overwrite. Probe
  // with a login to report safe state without touching anything.
  console.log("Invitation invalid/taken — attempting safe-state probe (no changes)...");
  const probe = await api("/api/auth/login", { method: "POST", body: { email: OWNER_EMAIL, password } }).catch(() => null);
  if (probe && probe.status === 200 && probe.body && probe.body.user) {
    safeUserLine("Existing account:", probe.body.user);
    console.log("No changes made. If ownership fields are wrong, an existing OWNER must fix them via /account/admin.");
  } else {
    console.log("No changes made. The account may exist with a different password, or the invite was spent.");
    console.log("Next: verify via normal /login, or /forgot-password for recovery. Ownership changes require an existing OWNER session.");
  }
  process.exit(0);
}
if (reg.status !== 201 || !reg.body || !reg.body.user) {
  fail(`Registration failed (status ${reg.status}: ${(reg.body && reg.body.error && reg.body.error.code) || "unknown"}).`, "Zero account changes persisted for this email (invite may still be PENDING).");
}
safeUserLine("Account created:", reg.body.user);

// --- Step 4: email verification ----------------------------------------------
let verifyToken = verifyTokenArg || "";
if (!verifyToken && isTTY) {
  console.log("If you have the verification token (dev outbox or email link), paste it; else press Enter to skip.");
  verifyToken = (await promptLine("Verification token (optional): ")).trim();
}
if (verifyToken) {
  const ver = await api("/api/auth/verify-email", { method: "POST", body: { token: verifyToken } }).catch(() => null);
  if (!ver || ver.status !== 200) {
    console.log(`Verification not completed (status ${ver ? ver.status : "network"}). Complete it via /verify-email, then re-run login below.`);
  } else {
    console.log("Email verified: account is ACTIVE.");
  }
} else if (target === "production") {
  console.log("NOTE: production currently has no email provider (NullMailer) — the verification link is discarded.");
  console.log("Complete verification once delivery exists, or apply the guarded finalize statement below AFTER confirming mailbox control.");
} else {
  console.log("Fetch the verification token from the dev outbox and verify:");
  console.log(`  wrangler d1 execute infaix-db --local --command="SELECT link_token FROM email_outbox WHERE to_email='${OWNER_EMAIL}' AND kind='email_verification' ORDER BY id DESC LIMIT 1;"`);
  console.log("  then re-run with --verify-token <token> (or complete via /verify-email).");
}

// --- Step 5: normal login + authoritative state report ------------------------
console.log("Logging in through the normal flow (session cookie stays in the cookie jar only)...");
const login = await api("/api/auth/login", { method: "POST", body: { email: OWNER_EMAIL, password } }).catch(() => null);
if (!login || login.status !== 200 || !login.setCookie) {
  const code = login && login.body && login.body.error ? login.body.error.code : "network";
  console.log(`Login did not complete (${code}). This is expected while status is PENDING_VERIFICATION — finish verification, then log in at /login.`);
  process.exit(0);
}
const sessionCookie = login.setCookie.split(";")[0];
const meAfter = await api("/api/auth/me", { cookie: sessionCookie }).catch(() => null);
if (!meAfter || meAfter.status !== 200 || !meAfter.body || !meAfter.body.user) {
  fail("Login succeeded but /me did not validate the session.", "Inspect server state; cookie was HttpOnly and never exposed.");
}
const u = meAfter.body.user;
safeUserLine("Owner session:", u);
console.log(`AI entitlement: ${meAfter.body.ai && meAfter.body.ai.enabled ? "ENABLED" : "DISABLED"} (server-authoritative canUseInfaixAI)`);
if (u.role !== OWNER_ROLE) console.log("WARNING: role is not OWNER — ownership was not established. Do not proceed.");
if (u.status !== "ACTIVE") console.log("NOTE: status is not ACTIVE yet — finish email verification, then log in at /login.");

// --- Step 6: optional guarded finalize (printed, NEVER executed here) ---------
const finalizeNow = Date.now();
console.log(`
--- Optional finalize (run ONLY after confirming mailbox control of ${OWNER_EMAIL}) ---
This sets the explicit ai_access flag (OWNER bypass already entitles AI) and
records the bootstrap audit event. It touches exactly one row:

  wrangler d1 execute infaix-db --command="UPDATE users SET ai_access = 1, role = 'OWNER', status = 'ACTIVE', email_verified = 1, display_name = '${OWNER_DISPLAY_NAME}', updated_at = ${finalizeNow} WHERE email = '${OWNER_EMAIL}' AND role = 'OWNER';"
  wrangler d1 execute infaix-db --command="INSERT INTO audit_log (event, actor_user_id, target_user_id, ip, detail, created_at) SELECT 'ACCOUNT_ENABLED', id, id, 'local-operator', 'owner-bootstrap', ${finalizeNow} FROM users WHERE email = '${OWNER_EMAIL}' AND role = 'OWNER';"

Verify afterwards: log in at /login -> /account shows Role OWNER, AI Enabled -> Open INFAIX AI -> /ai.
Remember to rotate/remove ADMIN_BOOTSTRAP_TOKEN once the owner exists.`);
console.log("\nOwner bootstrap complete. Password was never printed, logged, or stored (server holds only the PBKDF2 hash).");
