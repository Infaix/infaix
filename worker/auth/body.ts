const MAX_AUTH_JSON_BYTES = 16_384;

/** Closed, non-sensitive errors suitable for the existing API error envelope. */
export class AuthBodyError extends Error {
  constructor(
    readonly status: 400 | 413 | 415,
    readonly code: "INVALID_BODY" | "BODY_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE",
    message: string,
  ) {
    super(message);
    this.name = "AuthBodyError";
  }
}

const invalidBody = () => new AuthBodyError(400, "INVALID_BODY", "Expected a valid JSON object.");
const tooLarge = () => new AuthBodyError(413, "BODY_TOO_LARGE", "Request body is too large.");

/** Auth JSON only: byte-bounded even when Content-Length is absent or false. */
export async function readAuthJson(req: Request): Promise<Record<string, unknown>> {
  const length = req.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_AUTH_JSON_BYTES) {
    // Do not consume even the first chunk for a clearly oversized declaration.
    throw tooLarge();
  }
  const media = req.headers.get("content-type") ?? "";
  if (!/^\s*application\/json\s*(?:;\s*charset\s*=\s*(?:"utf-8"|utf-8)\s*)?$/i.test(media)) {
    throw new AuthBodyError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json with UTF-8 encoding.");
  }
  if (!req.body) throw invalidBody();

  const reader = req.body.getReader();
  const bytes = new Uint8Array(MAX_AUTH_JSON_BYTES);
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.byteLength > MAX_AUTH_JSON_BYTES - size) {
        // Initiate cancellation immediately; a slow/failing transport must not
        // prevent the 413 response. Never copy or retain the oversized chunk.
        void reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size));
    const body: unknown = JSON.parse(text);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw invalidBody();
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AuthBodyError) throw error;
    // Never propagate parser/transport messages, causes, or submitted values.
    throw invalidBody();
  } finally {
    reader.releaseLock();
  }
}
