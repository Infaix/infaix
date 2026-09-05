// Email abstraction. Phase 1 has no production provider by design, so:
// - non-production: links land in the dev outbox table (testers/admins can
//   complete flows without email; raw tokens live ONLY in that table row,
//   never in logs).
// - production without a provider: NullMailer discards (endpoints still
//   respond neutrally; wiring a provider later only touches this file).
import type { Store } from "./store";

export interface Mailer {
  sendPasswordReset(toEmail: string, link: string, now: number): Promise<void>;
  sendVerification(toEmail: string, link: string, now: number): Promise<void>;
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

export class NullMailer implements Mailer {
  async sendPasswordReset(): Promise<void> {}
  async sendVerification(): Promise<void> {}
}

export function mailerFor(store: Store, environment: string | undefined): Mailer {
  return environment === "production" ? new NullMailer() : new OutboxMailer(store);
}

/** Link back to the static frontend page that completes the flow. */
export function flowLink(origin: string, path: "/reset-password" | "/verify-email", token: string): string {
  return `${origin}${path}?token=${encodeURIComponent(token)}`;
}
