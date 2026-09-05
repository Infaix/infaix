import { describe, expect, it } from "vitest";
import { handleAiChat, handleAiModels } from "../worker/auth/ai";
import { verifyAiAssertion } from "../worker/auth/assertion";
import { drainBackground, get, makeWorld, ORIGIN, post, registerVerifyLogin } from "./helpers";

const SSE_HELLO = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n';

interface Seen {
  auth?: string;
  body?: string;
  cookie?: string;
}

function sseUpstream(chunks: string, seen: Seen, status = 200, extraHeaders: Record<string, string> = {}) {
  return async (_input: string, init: RequestInit) => {
    const h = init.headers as Record<string, string>;
    seen.auth = h.authorization;
    seen.cookie = h.cookie;
    seen.body = init.body as string;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(chunks));
        c.close();
      },
    });
    return new Response(stream, { status, headers: { "content-type": "text/event-stream", ...extraHeaders } });
  };
}

async function aiUser(w: ReturnType<typeof makeWorld>, opts: { email?: string; role?: "OWNER" | "ADMIN" | "USER"; aiAccess?: boolean } = {}) {
  const { userId, cookie } = await registerVerifyLogin(w, { email: opts.email ?? "ada@infaix.com" });
  const patch: { role?: "OWNER" | "ADMIN" | "USER"; ai_access?: number; updated_at: number } = { updated_at: w.getNow() };
  if (opts.role) patch.role = opts.role;
  if (opts.aiAccess !== undefined) patch.ai_access = opts.aiAccess ? 1 : 0;
  await w.store.updateUser(userId, patch);
  return { userId, cookie };
}

function chatReq(body: unknown, cookie?: string) {
  return post("/api/ai/chat", body, cookie);
}

describe("AI auth & authorization", () => {
  it("unauthenticated chat → 401", async () => {
    const w = makeWorld();
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hi there friend" }] }));
    expect(res.status).toBe(401);
  });

  it("invalid session → 401", async () => {
    const w = makeWorld();
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hi there friend" }] }, "infaix_session=bogus.sig"));
    expect(res.status).toBe(401);
  });

  it("ai_access=0 USER → 403 + AI_ACCESS_DENIED audit", async () => {
    const w = makeWorld();
    const { cookie } = await aiUser(w, { aiAccess: false });
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hi there friend" }] }, cookie));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("FORBIDDEN");
    expect(w.store.audits.some((a) => a.event === "AI_ACCESS_DENIED")).toBe(true);
  });

  it("disabled user → 401 even with ai_access", async () => {
    const w = makeWorld();
    const { cookie, userId } = await aiUser(w, { aiAccess: true });
    await w.store.updateUser(userId, { status: "DISABLED", updated_at: w.getNow() });
    await w.store.deleteUserSessions(userId);
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hi there friend" }] }, cookie));
    expect(res.status).toBe(401);
  });

  it("OWNER bypasses the grant; ADMIN without grant is denied", async () => {
    const w = makeWorld();
    const owner = await aiUser(w, { email: "owner@infaix.com", role: "OWNER" });
    const seen: Seen = {};
    w.ctx.upstreamFetch = sseUpstream(SSE_HELLO, seen);
    const okRes = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hello owner here" }] }, owner.cookie));
    expect(okRes.status).toBe(200);

    const admin = await aiUser(w, { email: "admin@infaix.com", role: "ADMIN" });
    const denied = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hello admin here" }] }, admin.cookie));
    expect(denied.status).toBe(403);

    await w.store.updateUser(admin.userId, { ai_access: 1, updated_at: w.getNow() });
    const allowed = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hello admin here" }] }, admin.cookie));
    expect(allowed.status).toBe(200);
  });
});

describe("AI chat proxy", () => {
  it("streams SSE with request id + conversation id, forwards Bearer assertion only", async () => {
    const w = makeWorld();
    const { cookie } = await aiUser(w, { aiAccess: true });
    const seen: Seen = {};
    w.ctx.upstreamFetch = sseUpstream(SSE_HELLO, seen);
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "say hello please" }] }, cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toMatch(/^req_[0-9a-f]{24}$/);
    expect(res.headers.get("x-conversation-id")).toMatch(/^convo_[0-9a-f]{24}$/);
    const text = await res.text();
    expect(text).toContain("Hello");
    expect(text).toContain("[DONE]");

    // upstream received a Bearer assertion — never the session cookie/secret
    expect(seen.cookie).toBeUndefined();
    expect(seen.auth).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(seen.body).toContain('"stream":true');
    const token = (seen.auth as string).slice("Bearer ".length);
    expect(token).not.toContain("ai-gateway-shared-secret");
    const env = w.ctx.env;
    const check = await verifyAiAssertion({
      token,
      secrets: { current: new TextEncoder().encode(env.AI_GATEWAY_SECRET as string), previous: null },
      expectedReqBinding: undefined,
      nowSec: Math.floor(w.getNow() / 1000) + 10,
    });
    expect(check.ok).toBe(true);

    // persistence ran in background: user + assistant messages stored
    await drainBackground(w);
    const meRow = await w.store.getUserByEmail("ada@infaix.com");
    if (!meRow) throw new Error("missing user");
    const convos = await w.store.listConversations(meRow.id, 10);
    expect(convos).toHaveLength(1);
    const msgs = await w.store.listMessages(convos[0].id, 10);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[1].content).toBe("Hello world");
  });

  it("rejects invalid JSON, oversized bodies, bad messages, bad models", async () => {
    const w = makeWorld();
    const { cookie } = await aiUser(w, { aiAccess: true });
    const badJson = new Request(`${ORIGIN}/api/ai/chat`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, cookie }, body: "{oops" });
    expect((await handleAiChat(w.ctx, badJson)).status).toBe(400);

    const big = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "x".repeat(70000) }] }, cookie));
    expect(big.status).toBe(413);

    const empty = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [] }, cookie));
    expect(empty.status).toBe(400);
    const badRole = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "hacker", content: "hi there friend" }] }, cookie));
    expect(badRole.status).toBe(400);
    const badModel = await handleAiChat(w.ctx, chatReq({ model: "llama3:8b-evil", messages: [{ role: "user", content: "hi there friend" }] }, cookie));
    expect(badModel.status).toBe(400);
    expect(((await badModel.json()) as { error: { code: string } }).error.code).toBe("INVALID_MODEL");
    const badConvo = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hi there friend" }], conversationId: "nope" }, cookie));
    expect(badConvo.status).toBe(400);
  });

  it("foreign conversation ids 404", async () => {
    const w = makeWorld();
    const a = await aiUser(w, { email: "a@infaix.com", aiAccess: true });
    const b = await aiUser(w, { email: "b@infaix.com", aiAccess: true });
    const seen: Seen = {};
    w.ctx.upstreamFetch = sseUpstream(SSE_HELLO, seen);
    const first = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hello from A here" }] }, a.cookie));
    const convoId = first.headers.get("x-conversation-id") as string;
    const cross = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hello from B here" }], conversationId: convoId }, b.cookie));
    expect(cross.status).toBe(404);
    await drainBackground(w);
  });

  it("upstream timeout → 504, no internals leaked", async () => {
    const w = makeWorld({ AI_UPSTREAM_TIMEOUT_MS: "1000" });
    const { cookie } = await aiUser(w, { aiAccess: true });
    // hanging upstream that rejects on abort, like a real fetch would
    w.ctx.upstreamFetch = async (_input: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "take your time now" }] }, cookie));
    expect(res.status).toBe(504);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("UPSTREAM_TIMEOUT");
  });

  it("upstream failure → safe 502 with request id, never infra details", async () => {
    const w = makeWorld();
    const { cookie } = await aiUser(w, { aiAccess: true });
    w.ctx.upstreamFetch = async () => new Response("ECONNREFUSED 10.0.0.9:11434", { status: 500 });
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hello gateway down" }] }, cookie));
    expect(res.status).toBe(502);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("10.0.0.9");
    expect(body).not.toContain("11434");
    expect(body).not.toContain("ai.infaix.com");
    expect(body).toContain("requestId");
  });

  it("upstream 429 passes through as rate limited", async () => {
    const w = makeWorld();
    const { cookie } = await aiUser(w, { aiAccess: true });
    const seen: Seen = {};
    w.ctx.upstreamFetch = sseUpstream("", seen, 429, { "retry-after": "45" });
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hello busy gateway" }] }, cookie));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("45");
  });

  it("missing gateway config → 503 without leaking", async () => {
    const w = makeWorld({ AI_GATEWAY_URL: undefined, AI_GATEWAY_SECRET: undefined });
    // keep secret missing but url present variant too
    const { cookie } = await aiUser(w, { aiAccess: true });
    const res = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "hello missing cfg" }] }, cookie));
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("ai-gateway-shared-secret");
  });

  it("chat is rate limited per user", async () => {
    const w = makeWorld({ AI_CHAT_USER_LIMIT: "1", AI_CHAT_USER_WINDOW: "3600" });
    const { cookie } = await aiUser(w, { aiAccess: true });
    const seen: Seen = {};
    w.ctx.upstreamFetch = sseUpstream(SSE_HELLO, seen);
    const first = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "first message here" }] }, cookie));
    expect(first.status).toBe(200);
    await drainBackground(w);
    const second = await handleAiChat(w.ctx, chatReq({ model: "infaix-default", messages: [{ role: "user", content: "second message here" }] }, cookie));
    expect(second.status).toBe(429);
  });
});

describe("AI models endpoint", () => {
  it("requires auth and reports logical models + grant", async () => {
    const w = makeWorld();
    expect((await handleAiModels(w.ctx, get("/api/ai/models"))).status).toBe(401);
    const { cookie } = await aiUser(w, { aiAccess: true });
    const res = await handleAiModels(w.ctx, get("/api/ai/models", cookie));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { models: { id: string }[]; ai_access: boolean };
    expect(data.models).toEqual([{ id: "infaix-default", display: "INFAIX Default" }]);
    expect(data.ai_access).toBe(true);
    expect(JSON.stringify(data)).not.toContain("11434");
  });
});
