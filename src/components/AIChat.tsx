"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiModel {
  id: string;
  display: string;
}

type ChatState =
  | { kind: "loading" }
  | { kind: "signin" }
  | { kind: "no-access" }
  | { kind: "ready" }
  | { kind: "unavailable"; message: string };

async function readSseDelta(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<{ texts: string[]; done: boolean }> {
  const decoder = new TextDecoder();
  const { value, done } = await reader.read();
  if (done) return { texts: [], done: true };
  const chunk = decoder.decode(value, { stream: true });
  const texts: string[] = [];
  let streamDone = false;
  for (const block of chunk.split("\n\n")) {
    for (const line of block.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") {
        streamDone = true;
        continue;
      }
      try {
        const j = JSON.parse(data) as Record<string, unknown>;
        const choices = Array.isArray(j.choices) ? (j.choices[0] as Record<string, unknown> | undefined) : undefined;
        const delta = choices && typeof choices.delta === "object" && choices.delta !== null
          ? ((choices.delta as Record<string, unknown>).content as unknown)
          : undefined;
        if (typeof delta === "string" && delta) texts.push(delta);
      } catch {
        // Ignore keep-alives and non-JSON frames.
      }
    }
  }
  return { texts, done: streamDone };
}

export default function AIChat() {
  const [state, setState] = useState<ChatState>({ kind: "loading" });
  const [models, setModels] = useState<AiModel[]>([]);
  const [model, setModel] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/ai/models")
      .then(async (res) => {
        if (!live) return;
        if (res.status === 401) {
          setState({ kind: "signin" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "unavailable", message: "INFAIX AI is in standby. The backend is not yet connected." });
          return;
        }
        const data = (await res.json()) as { models?: AiModel[]; ai_access?: boolean };
        setModels(Array.isArray(data.models) ? data.models : []);
        if (data.models && data.models.length > 0) setModel(data.models[0].id);
        setState(data.ai_access ? { kind: "ready" } : { kind: "no-access" });
      })
      .catch(() => {
        if (live) setState({ kind: "unavailable", message: "INFAIX AI is in standby. The backend is not yet connected." });
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || !model) return;
    const userMsg: Message = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    let assistantText = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    const pushText = (t: string) => {
      assistantText += t;
      const snapshot = assistantText;
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: snapshot };
        return copy;
      });
    };
    const failWith = (message: string) => {
      const snapshot = assistantText;
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: snapshot ? snapshot + "\n\n" + message : message,
        };
        return copy;
      });
    };

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          conversationId,
        }),
      });
      const conv = res.headers.get("x-conversation-id");
      if (conv) setConversationId(conv);
      if (res.status === 401) {
        failWith("Your session expired. Please log in again.");
        return;
      }
      if (res.status === 403) {
        failWith("AI access is not enabled for this account.");
        return;
      }
      if (res.status === 429) {
        failWith("AI is busy right now. Please try again shortly.");
        return;
      }
      if (!res.ok || !res.body) {
        const requestId = res.headers.get("x-request-id");
        failWith(`AI service error.${requestId ? ` (ref ${requestId})` : ""} Please try again.`);
        return;
      }
      const reader = res.body.getReader();
      for (;;) {
        const { texts, done } = await readSseDelta(reader);
        for (const t of texts) pushText(t);
        if (done) break;
      }
      try {
        await reader.cancel().catch(() => undefined);
      } catch {
        // ignore
      }
    } catch {
      failWith("Could not reach INFAIX AI. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const statusBar = (
    <div className="ai-status-bar">
      <div className="ai-status-item">
        <label>MODEL</label>
        <div className="value">
          {models.length > 1 ? (
            <select
              aria-label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              style={{ background: "transparent", color: "inherit", border: "none", font: "inherit" }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} style={{ color: "#000" }}>
                  {m.display}
                </option>
              ))}
            </select>
          ) : (
            <span className="ai-status-offline">{models[0]?.display ?? "—"}</span>
          )}
        </div>
      </div>
      <div className="ai-status-item">
        <label>ENVIRONMENT</label>
        <div className="value">FORGE</div>
      </div>
      <div className="ai-status-item">
        <label>Status</label>
        <div className={`value ${state.kind === "ready" ? "ai-status-online" : "ai-status-offline"}`}>
          {state.kind === "ready" && <span className="ai-pulse" aria-hidden="true" />}
          {state.kind === "ready" ? "ONLINE" : state.kind === "loading" ? "CONNECTING" : "STANDBY"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="ai-panel">
      {statusBar}

      <div className="ai-messages" role="log" aria-live="polite">
        {state.kind === "loading" && <div className="ai-hint">Connecting to INFAIX AI…</div>}
        {state.kind === "signin" && (
          <div className="ai-hint">
            Sign in to use INFAIX AI. <Link href="/login">Log in</Link>
          </div>
        )}
        {state.kind === "no-access" && (
          <div className="ai-hint">AI access is not enabled for this account. Contact an INFAIX admin.</div>
        )}
        {state.kind === "unavailable" && <div className="ai-hint">{state.message}</div>}
        {(state.kind === "ready" || messages.length > 0) &&
          messages.length === 0 &&
          !loading && <div className="ai-hint">What are you building?</div>}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`ai-msg ${msg.role}`}
            role="article"
            aria-label={msg.role === "user" ? "You" : "INFAIX AI"}
          >
            {msg.content}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="ai-msg assistant" aria-label="INFAIX AI">
            Thinking…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        className="ai-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <label htmlFor="ai-input" className="sr-only">
          Ask INFAIX AI
        </label>
        <input
          id="ai-input"
          className="ai-input"
          type="text"
          placeholder="Ask INFAIX AI..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || state.kind !== "ready"}
          autoComplete="off"
        />
        <button type="submit" className="ai-send" disabled={loading || !input.trim() || state.kind !== "ready"}>
          Send
        </button>
      </form>
    </div>
  );
}
