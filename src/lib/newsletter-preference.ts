export type NewsletterStatus = "SUBSCRIBED" | "UNSUBSCRIBED" | "PENDING_CONFIRMATION" | null;

export type NewsletterPreference =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "ready"; status: NewsletterStatus };

/**
 * A failed read never becomes "not subscribed".
 * A later failure keeps the last successful status.
 * A failed read does not subscribe or unsubscribe anyone; this function only classifies the view.
 */
export function settlePreference(
  previous: NewsletterPreference,
  ok: boolean,
  status: unknown
): NewsletterPreference {
  if (ok && (status === null || status === "SUBSCRIBED" || status === "UNSUBSCRIBED" || status === "PENDING_CONFIRMATION")) return { state: "ready", status };
  if (previous.state === "ready") return previous;
  return { state: "unavailable" };
}
