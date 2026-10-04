import { describe, expect, it } from "vitest";
import { AuthBodyError, readAuthJson } from "../worker/auth/body";

const encoder = new TextEncoder();
function request(body: string, media: string | null = "application/json", length?: string) {
  const req = new Request("https://infaix.com/api/auth/login", {
    method: "POST", headers: { "content-type": media ?? "application/json" }, body,
  });
  if (media === null) req.headers.delete("content-type");
  if (length !== undefined) req.headers.set("content-length", length);
  return req;
}

// No prefetch: pulls measure how much the reader consumes, not transport buffering.
function streamed(chunks: Uint8Array[], length?: string) {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[pulls++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST", headers: { "content-type": "application/json" },
    body: stream, duplex: "half",
  };
  const req = new Request("https://infaix.com/api/auth/login", init);
  if (length !== undefined) req.headers.set("content-length", length);
  return { req, pulls: () => pulls, cancelled: () => cancelled };
}

describe("bounded auth JSON", () => {
  it.each([
    ["{}", {}],
    ['{"email":"test@infaix.com","remember":false}', { email: "test@infaix.com", remember: false }],
    ['{"name":"é🙂漢字"}', { name: "é🙂漢字" }],
  ])("accepts object JSON %s", async (body, expected) => {
    expect(await readAuthJson(request(body))).toEqual(expected);
  });

  it.each([undefined, "16384"])("accepts exactly 16,384 bytes with length %s", async (length) => {
    const body = '{"x":"' + "a".repeat(16_376) + '"}';
    expect(encoder.encode(body).byteLength).toBe(16_384);
    const source = streamed([encoder.encode(body.slice(0, 8000)), encoder.encode(body.slice(8000))], length);
    expect(await readAuthJson(source.req)).toEqual({ x: "a".repeat(16_376) });
    expect(source.cancelled()).toBe(false);
  });

  it.each([undefined, "2"])("rejects one byte over with missing/lying length %s", async (length) => {
    const body = '{"x":"' + "a".repeat(16_377) + '"}';
    expect(encoder.encode(body).byteLength).toBe(16_385);
    await expect(readAuthJson(streamed([encoder.encode(body)], length).req)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects declared overflow before the first body pull", async () => {
    const source = streamed([encoder.encode("{}")], "16385");
    await expect(readAuthJson(source.req)).rejects.toMatchObject({ status: 413 });
    expect(source.pulls()).toBe(0);
  });

  it("counts UTF-8 bytes rather than characters", async () => {
    const body = JSON.stringify({ x: "é".repeat(8190) });
    expect(body.length).toBeLessThan(16_384);
    expect(encoder.encode(body).byteLength).toBeGreaterThan(16_384);
    await expect(readAuthJson(request(body))).rejects.toMatchObject({ status: 413 });
  });

  it("cancels at overflow without pulling the rest or parsing a truncated object", async () => {
    const source = streamed([
      encoder.encode("{}"), new Uint8Array(16_382).fill(32),
      encoder.encode(" "), new Uint8Array(100_000),
    ]);
    await expect(readAuthJson(source.req)).rejects.toMatchObject({ status: 413 });
    expect(source.pulls()).toBe(3);
    expect(source.cancelled()).toBe(true);
    expect(source.req.body?.locked).toBe(false);
  });

  it("decodes multibyte UTF-8 split across stream chunks", async () => {
    const bytes = encoder.encode('{"x":"🙂é"}');
    const source = streamed(Array.from(bytes, (byte) => new Uint8Array([byte])));
    expect(await readAuthJson(source.req)).toEqual({ x: "🙂é" });
  });

  it.each(["application/json", "application/json; charset=utf-8", 'Application/JSON; charset="UTF-8"'])(
    "accepts JSON media type %s", async (media) => {
      expect(await readAuthJson(request("{}", media))).toEqual({});
    },
  );

  it.each([null, "text/plain", "application/x-www-form-urlencoded", "application/vnd.infaix+json", "application/json; charset=iso-8859-1"])(
    "rejects unsupported media type %s", async (media) => {
      await expect(readAuthJson(request("{}", media))).rejects.toMatchObject({ status: 415 });
    },
  );

  it.each(["", "{bad", '{"x":', "null", "[]", '"text"', "42", "true", "false"])(
    "rejects malformed or non-object JSON %s", async (body) => {
      await expect(readAuthJson(request(body))).rejects.toMatchObject({ status: 400 });
    },
  );

  it("rejects invalid UTF-8 instead of silently replacing bytes", async () => {
    const bytes = new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125]);
    await expect(readAuthJson(streamed([bytes]).req)).rejects.toMatchObject({ status: 400 });
  });

  it("sanitizes stream errors rather than exposing submitted secrets", async () => {
    const secret = "password-cookie-token-private-email@infaix.com";
    const stream = new ReadableStream<Uint8Array>({ pull() { throw new Error(secret); } }, { highWaterMark: 0 });
    const init: RequestInit & { duplex: "half" } = {
      method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half",
    };
    const error = await readAuthJson(new Request("https://infaix.com/api/auth/login", init)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthBodyError);
    expect(error).toMatchObject({ status: 400 });
    expect(String(error)).not.toContain(secret);
    expect(JSON.stringify(error)).not.toContain(secret);
  });
});
