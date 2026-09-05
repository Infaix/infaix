"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AI_API_URL =
  process.env.NEXT_PUBLIC_AI_API_URL || "";

const STATUS_LABEL = AI_API_URL ? "ONLINE" : "STANDBY";

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    if (!AI_API_URL) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "INFAIX AI is in standby. The backend is not yet connected.\n\nSet NEXT_PUBLIC_AI_API_URL to connect to your FORGE AI infrastructure.",
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const allMessages = [...messages, userMsg];
      const res = await fetch(AI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Backend returned ${res.status}`);
      }

      const data = await res.json();
      const assistantContent =
        data.choices?.[0]?.message?.content ||
        data.message?.content ||
        data.response ||
        "No response received.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantContent },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Failed to reach INFAIX AI backend."}`,
        },
      ]);
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

  return (
    <div className="ai-panel">
      <div className="ai-status-bar">
        <div className="ai-status-item">
          <label>MODEL</label>
          <div className="value ai-status-offline">
            {AI_API_URL ? "Connected" : "Not configured"}
          </div>
        </div>
        <div className="ai-status-item">
          <label>ENVIRONMENT</label>
          <div className="value">FORGE</div>
        </div>
        <div className="ai-status-item">
          <label>Status</label>
          <div
            className={`value ${
              AI_API_URL ? "ai-status-online" : "ai-status-offline"
            }`}
          >
            {AI_API_URL && <span className="ai-pulse" aria-hidden="true" />}
            {STATUS_LABEL}
          </div>
        </div>
      </div>

      <div className="ai-messages" role="log" aria-live="polite">
        {messages.length === 0 && !loading && (
          <div className="ai-hint">What are you building?</div>
        )}
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
        {loading && (
          <div className="ai-msg assistant" aria-label="INFAIX AI">
            Thinking...
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
          disabled={loading}
          autoComplete="off"
        />
        <button
          type="submit"
          className="ai-send"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}