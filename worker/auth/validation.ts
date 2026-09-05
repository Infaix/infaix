// Strict server-side input validation. Every auth endpoint validates
// with these helpers before touching the database. Error messages are
// safe to return: they describe the field problem, never account state.

export interface FieldError {
  field: string;
  message: string;
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  if (email.includes("..")) return null;
  return email;
}

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

/**
 * Password policy: 12–128 chars with at least 3 of 4 character classes.
 * Generous maximum avoids truncation bugs; minimum keeps entropy sane.
 */
export function checkPassword(raw: unknown): PasswordCheck {
  if (typeof raw !== "string") return { ok: false, message: "Password is required." };
  if (raw.length < 12) return { ok: false, message: "Password must be at least 12 characters." };
  if (raw.length > 128) return { ok: false, message: "Password must be at most 128 characters." };
  let classes = 0;
  if (/[a-z]/.test(raw)) classes++;
  if (/[A-Z]/.test(raw)) classes++;
  if (/[0-9]/.test(raw)) classes++;
  if (/[^A-Za-z0-9]/.test(raw)) classes++;
  if (classes < 3) {
    return { ok: false, message: "Password must mix at least 3 of: lowercase, uppercase, digits, symbols." };
  }
  return { ok: true };
}

export function checkDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 60) return null;
  if (/[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

/** Raw single-use tokens are 43-char base64url (32 random bytes). */
export function checkToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(t)) return null;
  return t;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
