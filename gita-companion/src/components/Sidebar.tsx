import { useChatStore } from "@/store/chatStore";
import type { Conversation } from "@/types";

// ─────────────────────────────────────────────────────────────
//  Sidebar — conversation history + navigation
// ─────────────────────────────────────────────────────────────

const QUOTES = [
  { text: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.", src: "2.47" },
  { text: "The soul is neither born nor does it die at any time.", src: "2.20" },
  { text: "Do not grieve for what is inevitable.", src: "2.27" },
  { text: "Let right deeds be thy motive, not the fruit which comes from them.", src: "3.9" },
  { text: "The mind is restless, turbulent, and very hard to subdue. But it can be controlled by constant practice.", src: "6.35" },
];

const QUOTE = QUOTES[Math.floor(Math.random() * QUOTES.length)];

// ── ConvItem ──────────────────────────────────────────────────

function ConvItem({
  conv,
  active,
  onSelect,
  onDelete,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`conv-item${active ? " active" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      aria-pressed={active}
    >
      <span className="conv-item-title">{conv.title}</span>
      <button
        className="conv-item-delete"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Delete conversation"
        tabIndex={-1}
      >
        ×
      </button>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    newConversation,
    selectConversation,
    deleteConversation,
  } = useChatStore();

  return (
    <aside className="sidebar">
      {/* Logo / header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark" aria-hidden>
            {/* OM symbol */}
            <svg viewBox="0 0 24 24" aria-hidden>
              <text
                x="12" y="17"
                textAnchor="middle"
                fontSize="15"
                fontFamily="serif"
                fill="currentColor"
              >
                ॐ
              </text>
            </svg>
          </div>
          <div>
            <div className="sidebar-logo-text">Gita Companion</div>
            <div className="sidebar-logo-sub">Bhagavad Gita AI</div>
          </div>
        </div>

        <button
          className="btn-new-chat"
          onClick={() => newConversation()}
          aria-label="New conversation"
        >
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          New conversation
        </button>
      </div>

      {/* Conversation list */}
      <nav
        className="sidebar-list"
        role="list"
        aria-label="Conversation history"
      >
        {conversations.length === 0 && (
          <p
            style={{
              padding: "var(--s-3) var(--s-2)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--fog)",
              lineHeight: 1.6,
            }}
          >
            No conversations yet.
          </p>
        )}

        {conversations.length > 0 && (
          <>
            <div className="sidebar-section-label">
              <span className="label">Recent</span>
            </div>
            {conversations.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeConversationId}
                onSelect={() => selectConversation(conv.id)}
                onDelete={() => deleteConversation(conv.id)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Footer quote */}
      <div className="sidebar-footer">
        <p className="sidebar-footer-quote">"{QUOTE.text}"</p>
        <p className="sidebar-footer-attr">Bhagavad Gita {QUOTE.src}</p>
      </div>
    </aside>
  );
}
