// Email abstraction. Non-production links land in the deterministic dev
// outbox; production requires an explicitly configured transactional provider.
// Raw verification/reset tokens are sent only inside the provider request body
// and are never returned, logged, or persisted outside their hashed records.
import type { Store } from "./store";
import type { Env } from "./types";

export interface Mailer {
  sendPasswordReset(toEmail: string, link: string, now: number): Promise<void>;
  sendVerification(toEmail: string, link: string, now: number): Promise<void>;
}

export type MailFetch = (input: string, init: RequestInit) => Promise<Response>;

export class EmailDeliveryUnavailableError extends Error {
  constructor() {
    super("Transactional email is not configured.");
    this.name = "EmailDeliveryUnavailableError";
  }
}

export class OutboxMailer implements Mailer {
  constructor(private store: Store) {}
  async sendPasswordReset(toEmail: string, link: string, now: number): Promise<void> {
    const token = link.split("token=").pop() ?? link;
    await this.store.insertOutbox("password_reset", toEmail, token, now);
  }
  async sendVerification(toEmail: string, link: string, now: number): Promise<void> {
    const token = link.split("token=").pop() ?? link;
    await this.store.insertOutbox("email_verification", toEmail, token, now);
  }
}

/** Fails closed: production must never silently discard a verification link. */
export class UnavailableMailer implements Mailer {
  async sendPasswordReset(): Promise<void> {
    throw new EmailDeliveryUnavailableError();
  }
  async sendVerification(): Promise<void> {
    throw new EmailDeliveryUnavailableError();
  }
}

/** Minimal Resend REST adapter; credentials remain Worker runtime secrets. */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly send: MailFetch = fetch
  ) {}

  async sendPasswordReset(toEmail: string, link: string): Promise<void> {
    await this.deliver(toEmail, "Reset your INFAIX password", "Use this link to reset your INFAIX password:", link);
  }

  async sendVerification(toEmail: string, link: string): Promise<void> {
    await this.deliver(toEmail, "Verify your INFAIX email", "Use this link to verify your INFAIX email:", link);
  }

  private async deliver(to: string, subject: string, intro: string, link: string): Promise<void> {
    const requestId = crypto.randomUUID();
    // TEMPORARY PROD DIAGNOSTIC (Resend 500) — remove after root-caused.
    // Metadata only: never the API key, Authorization header, link/token,
    // passwords, or request secrets.
    console.error({
      request_id: requestId,
      phase: "resend:pre-fetch",
      endpoint: "https://api.resend.com/emails",
      from: this.from,
      to,
      subject,
    });
    let res: Response;
    try {
      res = await this.send("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject,
          text: `${intro}\n${link}`,
          html: `<p>${intro}</p><p><a href="${link}">Continue</a></p>`,
        }),
      });
    } catch (error) {
      console.error({
        request_id: requestId,
        phase: "resend:throw",
        http_status: null,
        response_body: null,
        response_headers: null,
        error_name: error instanceof Error ? error.name : typeof error,
        error: error instanceof Error ? error.message : "unknown",
        error_stack:
          error instanceof Error && typeof error.stack === "string" ? error.stack.slice(0, 2000) : null,
      });
      throw error;
    }
    if (!res.ok) {
      console.error({
        request_id: requestId,
        phase: "resend:non-ok",
        http_status: res.status,
        response_body: await res.text(),
        response_headers: Object.fromEntries(res.headers.entries()),
      });
      throw new Error("Transactional email delivery failed.");
    }
  }
}

export function productionMailConfigured(env: Env): boolean {
  return env.ENVIRONMENT !== "production" || (
    env.EMAIL_PROVIDER === "resend" &&
    typeof env.EMAIL_FROM === "string" && env.EMAIL_FROM.trim().length > 0 &&
    typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.length > 0
  );
}

export function mailerFor(store: Store, env: Env, send: MailFetch = fetch): Mailer {
  if (env.ENVIRONMENT !== "production") return new OutboxMailer(store);
  if (!productionMailConfigured(env)) return new UnavailableMailer();
  return new ResendMailer(env.RESEND_API_KEY!, env.EMAIL_FROM!.trim(), send);
}

/** Link back to the static frontend page that completes the flow. */
export function flowLink(origin: string, path: "/reset-password" | "/verify-email", token: string): string {
  return `${origin}${path}?token=${encodeURIComponent(token)}`;
}
