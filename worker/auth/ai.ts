// Browser-facing AI bridge: session auth + AI_ACCESS + jose assertion +
// SSE proxy to the separate InfaixAI gateway. This repository never touches
// Ollama, models, or GPUs — it only authenticates, authorizes, validates,
// and proxies. Chat returns raw Responses (streaming); the JSON endpoints
// return HandlerResults for the shared router.
import { gatewaySecrets, mintAiAssertion, requestBinding } from "./assertion";
import { audit } from "./audit";
import { checkRequestOrigin } from "./cors";
import { newId } from "./crypto";
import { canUseInfaixAI } from "./entitlement";
import type { HandlerContext, HandlerResult } from "./handlers";
import { checkRateLimit, limitFromEnv } from "./ratelimit";
import { verifySession } from "./sessions";
import type { UserRow } from "./types";
import { isRecord } from "./validation";

export const GATEWAY_CHAT_PATH = "/chat";

/** Logical model IDs the browser may request. Real tags resolve in InfaixAI. */
export const LOGICAL_MODELS = [{ id: "infaix-default", display: "INFAIX Default" }] as const;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 50;
const MAX_CONTENT_CHARS = 8000;
const MAX_TOTAL_CHARS = 32_000;
const MAX_TITLE_CHARS = 80;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 120_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function jsonError(code: string, message: string, status: number, requestId: string): Response {
  return Response.json({ error: { code, message, requestId } }, { status });
}

function upstreamTimeoutMs(env: HandlerContext["env"]): number {
  const raw = env.AI_UPSTREAM_TIMEOUT_MS ? Number.parseInt(env.AI_UPSTREAM_TIMEOUT_MS, 10) : NaN;
  if (!Number.isSafeInteger(raw) || raw < 1000 || raw > 600_000) return DEFAULT_UPSTREAM_TIMEOUT_MS;
  return raw;
}

export function gatewayBase(env: HandlerContext["env"]): string | null {
  const raw = (env.AI_GATEWAY_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && env.ENVIRONMENT === "production") return null;
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

interface AiAuth {
  user: UserRow;
}

/** Session + ACTIVE + AI_ACCESS via the single entitlement function. */
async function requireAiAccess(
  ctx: HandlerContext,
  req: Request,
  requestId: string
): Promise<{ ok: true; auth: AiAuth } | { ok: false; response: Response }> {
  const authed = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (!authed) {
    await audit(ctx.store, "AI_AUTH_FAILURE", { ip: ctx.ip, detail: `rid:${requestId} unauthenticated`, now: ctx.now() });
    return { ok: false, response: jsonError("UNAUTHENTICATED", "Not signed in.", 401, requestId) };
  }
  if (!(await canUseInfaixAI(ctx.store, authed.user.id))) {
    await audit(ctx.store, "AI_ACCESS_DENIED", {
      actor: authed.user.id,
      target: authed.user.id,
      ip: ctx.ip,
      detail: `rid:${requestId} role:${authed.user.role}`,
      now: ctx.now(),
    });
    return { ok: false, response: jsonError("FORBIDDEN", "AI access is not enabled for this account.", 403, requestId) };
  }
  return { ok: true, auth: { user: authed.user } };
}


// ---------------------------------------------------------------- models

export async function handleAiModels(ctx: HandlerContext, req: Request): Promise<Response> {
  const requestId = newId("req");
  const authed = await verifySession(
    { store: ctx.store, env: ctx.env, now: ctx.now, ip: ctx.ip, userAgent: ctx.userAgent, secure: ctx.secure },
    req.headers.get("cookie")
  );
  if (!authed) return jsonError("UNAUTHENTICATED", "Not signed in.", 401, requestId);
  return Response.json({
    models: LOGICAL_MODELS.map((m) => ({ ...m })),
    ai_access: await canUseInfaixAI(ctx.store, authed.user.id),
    requestId,
  });
}

// ---------------------------------------------------------------- chat validation

export interface ValidChat {
  model: string;
  messages: ChatMessage[];
  conversationId: string | null;
}

const VALID_ROLES = ["system", "user", "assistant"];

export function validateChatBody(body: unknown):
  | { ok: true; chat: ValidChat }
  | { ok: false; code: string; message: string; status: number } {
  if (!isRecord(body)) return { ok: false, code: "INVALID_REQUEST", message: "Request body must be JSON.", status: 400 };
  if (typeof body.model !== "string" || !LOGICAL_MODELS.some((m) => m.id === body.model)) {
    return { ok: false, code: "INVALID_MODEL", message: "Unknown or disabled model.", status: 400 };
  }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
    return { ok: false, code: "INVALID_REQUEST", message: `messages must contain 1-${MAX_MESSAGES} entries.`, status: 400 };
  }
  const messages: ChatMessage[] = [];
  let total = 0;
  for (const m of body.messages) {
    if (!isRecord(m) || typeof m.role !== "string" || !VALID_ROLES.includes(m.role) || typeof m.content !== "string") {
      return { ok: false, code: "INVALID_REQUEST", message: "Each message needs a valid role and string content.", status: 400 };
    }
    const content = m.content;
    if (content.length < 1 || content.length > MAX_CONTENT_CHARS) {
      return { ok: false, code: "INVALID_REQUEST", message: `Message content must be 1-${MAX_CONTENT_CHARS} characters.`, status: 400 };
    }
    total += content.length;
    messages.push({ role: m.role as ChatMessage["role"], content });
  }
  if (total > MAX_TOTAL_CHARS) {
    return { ok: false, code: "INVALID_REQUEST", message: `Total content exceeds ${MAX_TOTAL_CHARS} characters.`, status: 400 };
  }
  let conversationId: string | null = null;
  if (body.conversationId !== undefined && body.conversationId !== null) {
    if (typeof body.conversationId !== "string" || !/^convo_[0-9a-f]{24}$/.test(body.conversationId)) {
      return { ok: false, code: "INVALID_REQUEST", message: "Invalid conversation identifier.", status: 400 };
    }
    conversationId = body.conversationId;
  }
  return { ok: true, chat: { model: body.model, messages, conversationId } };
}

// ---------------------------------------------------------------- SSE persistence

/** Extract streamed assistant text from OpenAI-compatible SSE chunks. */
export function extractDelta(line: string): { text?: string; done?: boolean } {
  const t = line.trim();
  if (!t.startsWith("data:")) return {};
  const data = t.slice(5).trim();
  if (data === "[DONE]") return { done: true };
  try {
    const j: unknown = JSON.parse(data);
    if (!isRecord(j)) return {};
    const choices = Array.isArray(j.choices) ? j.choices[0] : undefined;
    const delta = choices && isRecord(choices) && isRecord(choices.delta) ? (choices.delta.content as unknown) : undefined;
    if (typeof delta === "string" && delta) return { text: delta };
    const msg = isRecord(j.message) ? (j.message.content as unknown) : undefined;
    if (typeof msg === "string" && msg) return { text: msg };
    for (const k of ["response", "text", "content"]) {
      const v = (j as Record<string, unknown>)[k];
      if (typeof v === "string" && v) return { text: v };
    }
  } catch {
    // Non-JSON SSE line (e.g. event: or comments) — ignore.
  }
  return {};
}

// ---------------------------------------------------------------- chat

export async function handleAiChat(ctx: HandlerContext, req: Request): Promise<Response> {
  const requestId = newId("req");
  const resHeaders = (extra: Record<string, string> = {}): HeadersInit => ({
    "x-request-id": requestId,
    ...extra,
  });

  if (!checkRequestOrigin(req, ctx.env, ctx.origin)) {
    return jsonError("FORBIDDEN", "Forbidden.", 403, requestId);
  }
  const gate = await requireAiAccess(ctx, req, requestId);
  if (!gate.ok) {
    gate.response.headers.set("x-request-id", requestId);
    return gate.response;
  }
  const { user } = gate.auth;

  const userRl = limitFromEnv(ctx.env, "AI_CHAT_USER_LIMIT", "AI_CHAT_USER_WINDOW", 60, 3600);
  const byUser = await checkRateLimit(ctx.store, `ai-chat:user:${user.id}`, userRl, ctx.now());
  if (!byUser.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "AI request limit reached. Try again later.", requestId } },
      { status: 429, headers: { ...resHeaders(), "retry-after": String(byUser.retryAfterSec) } }
    );
  }
  const ipRl = limitFromEnv(ctx.env, "AI_CHAT_IP_LIMIT", "AI_CHAT_IP_WINDOW", 10, 60);
  const byIp = await checkRateLimit(ctx.store, `ai-chat:ip:${ctx.ip ?? "unknown"}`, ipRl, ctx.now());
  if (!byIp.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "AI request limit reached. Try again later.", requestId } },
      { status: 429, headers: { ...resHeaders(), "retry-after": String(byIp.retryAfterSec) } }
    );
  }

  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.includes("application/json")) {
    return jsonError("INVALID_REQUEST", "Content-Type must be application/json.", 400, requestId);
  }
  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return jsonError("INVALID_REQUEST", "Could not read request body.", 400, requestId);
  }
  if (rawText.length > MAX_BODY_BYTES) {
    return jsonError("INVALID_REQUEST", "Request body too large.", 413, requestId);
  }
  let parsed: unknown;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    return jsonError("INVALID_REQUEST", "Request body must be valid JSON.", 400, requestId);
  }
  const valid = validateChatBody(parsed);
  if (!valid.ok) return jsonError(valid.code, valid.message, valid.status, requestId);
  const { model, messages, conversationId } = valid.chat;

  const now = ctx.now();
  let convoId = conversationId;
  if (convoId) {
    const convo = await ctx.store.getConversation(convoId);
    if (!convo || convo.user_id !== user.id) {
      return jsonError("NOT_FOUND", "Conversation not found.", 404, requestId);
    }
  } else {
    convoId = newId("convo");
    const firstUser = messages.find((m) => m.role === "user");
    await ctx.store.insertConversation({
      id: convoId,
      user_id: user.id,
      title: (firstUser ? firstUser.content : "New conversation").slice(0, MAX_TITLE_CHARS) || "New conversation",
      created_at: now,
      updated_at: now,
    });
  }

  const secrets = gatewaySecrets(ctx.env);
  if (!secrets.current) {
    await audit(ctx.store, "AI_GATEWAY_FAILURE", { actor: user.id, ip: ctx.ip, detail: `rid:${requestId} no-secret`, now });
    return jsonError("AI_UNAVAILABLE", "AI is temporarily unavailable.", 503, requestId);
  }
  const base = gatewayBase(ctx.env);
  if (!base) {
    await audit(ctx.store, "AI_GATEWAY_FAILURE", { actor: user.id, ip: ctx.ip, detail: `rid:${requestId} no-gateway`, now });
    return jsonError("AI_UNAVAILABLE", "AI is temporarily unavailable.", 503, requestId);
  }

  const gatewayBody = JSON.stringify({ model, messages, stream: true });
  const binding = await requestBinding("POST", GATEWAY_CHAT_PATH, new TextEncoder().encode(gatewayBody));
  const assertion = await mintAiAssertion({
    secret: secrets.current,
    audience: ctx.env.AI_GATEWAY_AUDIENCE || undefined,
    userId: user.id,
    role: user.role,
    aiAccess: true,
    reqBinding: binding,
    nowSec: Math.floor(ctx.now() / 1000),
  });

  await audit(ctx.store, "AI_REQUEST", {
    actor: user.id,
    ip: ctx.ip,
    detail: `rid:${requestId} model:${model} msgs:${messages.length}`,
    now,
  });

  const upstreamFetch = ctx.upstreamFetch ?? fetch;
  const timeout = AbortSignal.timeout(upstreamTimeoutMs(ctx.env));
  const clientAbort = req.signal;
  const ctrl = new AbortController();
  const onTimeout = (): void => ctrl.abort(new Error("upstream-timeout"));
  const onClientAbort = (): void => ctrl.abort(new Error("client-abort"));
  let timedOut = false;
  let clientGone = false;
  timeout.addEventListener("abort", () => {
    timedOut = true;
    onTimeout();
  });
  if (clientAbort.aborted) {
    clientGone = true;
  } else {
    clientAbort.addEventListener("abort", onClientAbort, { once: true });
  }

  let upstream: Response;
  try {
    // Only the assertion leaves this Worker — never cookies or secrets.
    upstream = await upstreamFetch(base + GATEWAY_CHAT_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${assertion}`,
        "x-request-id": requestId,
      },
      body: gatewayBody,
      signal: ctrl.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (timedOut || msg.includes("upstream-timeout") || (e instanceof Error && e.name === "TimeoutError")) {
      await audit(ctx.store, "AI_GATEWAY_FAILURE", { actor: user.id, ip: ctx.ip, detail: `rid:${requestId} timeout`, now: ctx.now() });
      return jsonError("UPSTREAM_TIMEOUT", "AI took too long to respond.", 504, requestId);
    }
    if (clientGone) return new Response(null, { status: 499, headers: resHeaders() });
    await audit(ctx.store, "AI_GATEWAY_FAILURE", { actor: user.id, ip: ctx.ip, detail: `rid:${requestId} unreachable`, now: ctx.now() });
    return jsonError("AI_UNAVAILABLE", "AI is temporarily unavailable.", 503, requestId);
  } finally {
    timeout.removeEventListener("abort", onTimeout);
    clientAbort.removeEventListener("abort", onClientAbort);
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status;
    if (status === 429) {
      const retry = upstream.headers.get("retry-after") ?? "60";
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "AI is busy. Try again shortly.", requestId } },
        { status: 429, headers: { ...resHeaders(), "retry-after": retry } }
      );
    }
    if (status === 401 || status === 403) {
      await audit(ctx.store, "AI_AUTH_FAILURE", { actor: user.id, ip: ctx.ip, detail: `rid:${requestId} gw:${status}`, now: ctx.now() });
    } else {
      await audit(ctx.store, "AI_GATEWAY_FAILURE", { actor: user.id, ip: ctx.ip, detail: `rid:${requestId} gw:${status}`, now: ctx.now() });
    }
    return jsonError("MODEL_ERROR", "AI service error. Try again shortly.", 502, requestId);
  }

  // Stream straight through (no buffering) while a background branch
  // accumulates the reply for persistence. Only clean completions persist.
  const [clientBranch, persistBranch] = upstream.body.tee();
  const conversationIdFinal = convoId;
  const persist = collectAndPersist(ctx, persistBranch, {
    conversationId: conversationIdFinal,
    userId: user.id,
    userMessages: messages,
    now,
  });
  if (ctx.waitUntil) ctx.waitUntil(persist);
  else persist.catch(() => undefined);

  return new Response(clientBranch, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      "x-request-id": requestId,
      "x-conversation-id": conversationIdFinal,
      "x-content-type-options": "nosniff",
    },
  });
}

async function collectAndPersist(
  ctx: HandlerContext,
  branch: ReadableStream<Uint8Array>,
  opts: { conversationId: string; userId: string; userMessages: { role: string; content: string }[]; now: number }
): Promise<void> {
  try {
    const reader = branch.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistant = "";
    let done = false;
    for (;;) {
      const { value, done: streamDone } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        const part = extractDelta(line);
        if (part.text) assistant += part.text;
        if (part.done) done = true;
      }
      if (streamDone) break;
    }
    try {
      await reader.cancel().catch(() => undefined);
    } catch {
      /* ignore */
    }
    if (!done || !assistant) return;
    const convo = await ctx.store.getConversation(opts.conversationId);
    if (!convo || convo.user_id !== opts.userId) return;
    for (const m of opts.userMessages) {
      await ctx.store.insertMessage(opts.conversationId, m.role, m.content, opts.now);
    }
    await ctx.store.insertMessage(opts.conversationId, "assistant", assistant, ctx.now());
    await ctx.store.touchConversation(opts.conversationId, ctx.now());
  } catch {
    // Persistence must never break the client stream or leak details.
  }
}

// ---------------------------------------------------------------- conversations (JSON)

export async function handleAiConversations(ctx: HandlerContext, req: Request): Promise<HandlerResult> {
  const requestId = newId("req");
  const gate = await requireAiAccess(ctx, req, requestId);
  if (!gate.ok) {
    const body = await gate.response.json();
    return { status: gate.response.status, body };
  }
  const user = gate.auth.user;
  if (req.method.toUpperCase() === "POST") {
    let title = "New conversation";
    try {
      const text = await req.text();
      if (text) {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).title === "string") {
          const t = ((parsed as Record<string, unknown>).title as string).trim();
          if (t) title = t.slice(0, MAX_TITLE_CHARS);
        }
      }
    } catch {
      return { status: 400, body: { error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON.", requestId } } };
    }
    const now = ctx.now();
    const convo = { id: newId("convo"), user_id: user.id, title, created_at: now, updated_at: now };
    await ctx.store.insertConversation(convo);
    return { status: 201, body: { conversation: convo, requestId } };
  }
  const rows = await ctx.store.listConversations(user.id, 50);
  return {
    status: 200,
    body: {
      conversations: rows.map((r) => ({ id: r.id, title: r.title, created_at: r.created_at, updated_at: r.updated_at })),
      requestId,
    },
  };
}

export async function handleAiConversation(ctx: HandlerContext, req: Request, id: string): Promise<HandlerResult> {
  const requestId = newId("req");
  const gate = await requireAiAccess(ctx, req, requestId);
  if (!gate.ok) {
    const body = await gate.response.json();
    return { status: gate.response.status, body };
  }
  const user = gate.auth.user;
  if (!/^convo_[0-9a-f]{24}$/.test(id)) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: "Conversation not found.", requestId } } };
  }
  const convo = await ctx.store.getConversation(id);
  if (!convo || convo.user_id !== user.id) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: "Conversation not found.", requestId } } };
  }
  if (req.method.toUpperCase() === "DELETE") {
    await ctx.store.deleteConversation(id);
    return { status: 200, body: { ok: true, requestId } };
  }
  const messages = await ctx.store.listMessages(id, 200);
  return {
    status: 200,
    body: {
      conversation: { id: convo.id, title: convo.title, created_at: convo.created_at, updated_at: convo.updated_at },
      messages: messages.map((m) => ({ role: m.role, content: m.content, created_at: m.created_at })),
      requestId,
    },
  };
}
