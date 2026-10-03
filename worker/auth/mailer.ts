// Email abstraction. Non-production links land in the deterministic dev
// outbox; production requires an explicitly configured transactional provider.
// Raw verification/reset tokens are sent only inside the provider request body
// and are never returned, logged, or persisted outside their hashed records.
import {
  renderPasswordChangedEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
  renderWelcomeEmail,
} from "./email-templates";
import type { Store } from "./store";
import type { Env } from "./types";

export interface Mailer {
  sendPasswordReset(toEmail: string, link: string, now: number): Promise<void>;
  sendVerification(toEmail: string, link: string, now: number): Promise<void>;
  sendWelcome(toEmail: string, loginUrl: string, now: number): Promise<void>;
  sendPasswordChanged(toEmail: string, resetUrl: string, now: number): Promise<void>;
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
  async sendWelcome(toEmail: string, _loginUrl: string, now: number): Promise<void> {
    await this.store.insertOutbox("account_welcome", toEmail, "notice", now);
  }
  async sendPasswordChanged(toEmail: string, _resetUrl: string, now: number): Promise<void> {
    await this.store.insertOutbox("password_changed", toEmail, "notice", now);
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
  async sendWelcome(): Promise<void> {
    throw new EmailDeliveryUnavailableError();
  }
  async sendPasswordChanged(): Promise<void> {
    throw new EmailDeliveryUnavailableError();
  }
}

/** Minimal Resend REST adapter; credentials remain Worker runtime secrets. */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly send: MailFetch = globalThis.fetch.bind(globalThis)
  ) {}

  async sendPasswordReset(toEmail: string, link: string, now: number): Promise<void> {
    void now;
    await this.deliver(toEmail, renderPasswordResetEmail(link));
  }

  async sendVerification(toEmail: string, link: string, now: number): Promise<void> {
    void now;
    await this.deliver(toEmail, renderVerificationEmail(link));
  }

  async sendWelcome(toEmail: string, loginUrl: string, now: number): Promise<void> {
    void now;
    await this.deliver(toEmail, renderWelcomeEmail(loginUrl));
  }

  async sendPasswordChanged(toEmail: string, resetUrl: string, now: number): Promise<void> {
    void now;
    await this.deliver(toEmail, renderPasswordChangedEmail(resetUrl));
  }

  private async deliver(to: string, message: { subject: string; text: string; html: string }): Promise<void> {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const diagnostic = (phase: string) => console.log({ request_id: requestId, phase: `mail:${phase}`, elapsed_ms: Date.now() - started });
    diagnostic("before-fetch");
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
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
    } catch (error) {
      diagnostic("throw");
      console.error("mail:throw failed", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    diagnostic("after-fetch");
    if (!res.ok) {
      diagnostic("non-ok");
      const error = new Error("Transactional email delivery failed.");
      console.error("mail:throw failed", { name: error.name, message: error.message });
      throw error;
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

export function mailerFor(store: Store, env: Env, send?: MailFetch): Mailer {
  if (env.ENVIRONMENT !== "production") return new OutboxMailer(store);
  if (!productionMailConfigured(env)) return new UnavailableMailer();
  return new ResendMailer(env.RESEND_API_KEY!, env.EMAIL_FROM!.trim(), send);
}

/** Link back to the static frontend page that completes the flow. */
export function flowLink(origin: string, path: "/reset-password" | "/verify-email" | "/login" | "/forgot-password", token?: string): string {
  if (!token) return `${origin}${path}`;
  return `${origin}${path}?token=${encodeURIComponent(token)}`;
}
