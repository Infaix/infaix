import { describe, expect, it } from "vitest";
import { handleAiChat, handleAiConversation, handleAiConversations } from "../worker/auth/ai";
import { drainBackground, get, makeWorld, post, registerVerifyLogin } from "./helpers";

async function aiUser(w: ReturnType<typeof makeWorld>, email: string) {
  const r = await registerVerifyLogin(w, { email });
  await w.store.updateUser(r.userId, { ai_access: 1, updated_at: w.getNow() });
  return r;
}

describe("AI conversations (main D1, ownership-enforced)", () => {
  it("creates, lists, reads, and deletes own conversations", async () => {
    const w = makeWorld();
    const { cookie } = await aiUser(w, "ada@infaix.com");
    const created = await handleAiConversations(w.ctx, post("/api/ai/conversations", { title: "My chat" }, cookie));
    expect(created.status).toBe(201);
    const id = (created.body as { conversation: { id: string } }).conversation.id;
    expect(id).toMatch(/^convo_[0-9a-f]{24}$/);

    const listed = await handleAiConversations(w.ctx, get("/api/ai/conversations", cookie));
    expect((listed.body as { conversations: unknown[] }).conversations).toHaveLength(1);

    const got = await handleAiConversation(w.ctx, get(`/api/ai/conversations/${id}`, cookie), id);
    expect(got.status).toBe(200);
    expect((got.body as { messages: unknown[] }).messages).toEqual([]);

    const del = await handleAiConversation(
      w.ctx,
      new Request(`https://infaix.com/api/ai/conversations/${id}`, { method: "DELETE", headers: { cookie } }),
      id
    );
    expect(del.status).toBe(200);
    const gone = await handleAiConversation(w.ctx, get(`/api/ai/conversations/${id}`, cookie), id);
    expect(gone.status).toBe(404);
  });

  it("never leaks across users; unauthenticated denied; malformed ids 404", async () => {
    const w = makeWorld();
    const a = await aiUser(w, "a@infaix.com");
    const b = await aiUser(w, "b@infaix.com");
    const created = await handleAiConversations(w.ctx, post("/api/ai/conversations", {}, a.cookie));
    const id = (created.body as { conversation: { id: string } }).conversation.id;

    expect((await handleAiConversation(w.ctx, get(`/api/ai/conversations/${id}`, b.cookie), id)).status).toBe(404);
    const delCross = await handleAiConversation(
      w.ctx,
      new Request(`https://infaix.com/api/ai/conversations/${id}`, { method: "DELETE", headers: { cookie: b.cookie } }),
      id
    );
    expect(delCross.status).toBe(404);
    // still intact for the owner
    expect((await handleAiConversation(w.ctx, get(`/api/ai/conversations/${id}`, a.cookie), id)).status).toBe(200);

    expect((await handleAiConversations(w.ctx, get("/api/ai/conversations"))).status).toBe(401);
    expect((await handleAiConversation(w.ctx, get("/api/ai/conversations/nope", a.cookie), "nope")).status).toBe(404);
  });

  it("broken streams do not persist partial state", async () => {
    const w = makeWorld();
    const { cookie, userId } = await aiUser(w, "ada@infaix.com");
    w.ctx.upstreamFetch = async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'));
          c.close(); // ends WITHOUT [DONE] — incomplete
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    };
    const res = await handleAiChat(
      w.ctx,
      post("/api/ai/chat", { model: "infaix-default", messages: [{ role: "user", content: "hello broken stream" }] }, cookie)
    );
    expect(res.status).toBe(200);
    await res.text();
    await drainBackground(w);
    // conversation shell exists (created for routing) but no messages persisted
    const convos = await w.store.listConversations(userId, 10);
    expect(convos).toHaveLength(1);
    expect(await w.store.listMessages(convos[0].id, 10)).toEqual([]);
  });
});
