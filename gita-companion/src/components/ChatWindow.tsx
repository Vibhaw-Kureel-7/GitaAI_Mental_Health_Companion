import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import { MessageBubble } from "./MessageBubble";
import { useChat } from "@/hooks/useChat";

// ─────────────────────────────────────────────────────────────
//  ChatWindow — message list + empty state with starter prompts
// ─────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "I feel completely overwhelmed and cannot stop panicking.",
  "I have no motivation to do anything anymore.",
  "My mind keeps racing and I cannot sleep.",
  "I feel like a failure after missing my goals.",
  "I am burnt out and do not know how to start again.",
  "I cannot stop overthinking every decision.",
];

export function ChatWindow() {
  const { getActiveMessages } = useChatStore();
  const { sendMessage } = useChat();
  const messages = getActiveMessages();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or status changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    messages.length,
    messages[messages.length - 1]?.status,
  ]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="chat-window">
        <div className="chat-empty">
          <div className="chat-empty-glyph" aria-hidden>ॐ</div>

          <h2 className="chat-empty-title">
            What troubles your mind today?
          </h2>

          <p className="chat-empty-body">
            A private, offline companion drawing wisdom from the Bhagavad
            Gita. Your words never leave this device.
          </p>

          <div className="chat-empty-prompts" role="list">
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                className="prompt-chip"
                onClick={() => sendMessage(p)}
                role="listitem"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="chat-window"
      role="log"
      aria-label="Conversation"
      aria-live="polite"
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
