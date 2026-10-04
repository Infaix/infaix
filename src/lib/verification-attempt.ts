/**
 * One verification-link visit should start one request.
 * A repeat call with the same token (React re-running an effect) returns null.
 * A different token, or a first visit, returns the token to submit.
 * A genuinely reused link is still submitted once; the server decides used/expired.
 */
export function verificationAttempt(token: string | null, alreadyStarted: string | null): string | null {
  if (!token) return null;
  if (token === alreadyStarted) return null;
  return token;
}
