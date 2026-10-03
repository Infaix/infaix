/**
 * Newsletter consent copy shown at opt-in. Registration never writes a
 * subscription by itself; a checked box calls the subscribe endpoint with
 * this version so the stored row records the exact text the person saw.
 * Status stays PENDING_CONFIRMATION until a later confirmation step.
 */
export const NEWSLETTER_POLICY_VERSION = "newsletter-2026-10-03";

export const NEWSLETTER_CONSENT_LABEL =
  "Send me INFAIX product news, launches and early-access updates. Optional. Unsubscribe anytime.";

/**
 * Where consent was captured. This is a legal record: it must name the surface
 * the person actually used, so the footer and homepage forms are labelled with
 * their own sources rather than folded into an account setting that never
 * happened. The Worker validates against exactly this list.
 */
export const NEWSLETTER_SOURCES = [
  "registration",
  "account-settings",
  "footer-form",
  "homepage",
] as const;

export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];
