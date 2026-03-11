import type { Message } from "@/types";
import { LLM_META } from "@/types";
import { RoutingPanel } from "./RoutingPanel";

interface Props {
  message: Message;
}

// ─────────────────────────────────────────────────────────────
//  MessageBubble — renders one message (user or assistant)
// ─────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const meta = message.routing
    ? LLM_META[message.routing.selectedKey]
    : null;

  return (
    <div className="message-group">
      {/* Role / meta row */}
      <div className="message-meta-row">
        <span className={`message-role-tag${isUser ? "" : " assistant"}`}>
          {isUser ? "You" : meta ? meta.shortName : "Gita AI"}
        </span>

        {!isUser && meta && (
          <>
            <span
              style={{
                color: "var(--smoke)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            >
              &mdash;
            </span>
            <span
              className="message-tradition"
              style={{ color: meta.color, fontSize: 10 }}
            >
              {meta.tradition}
            </span>
          </>
        )}

        <span className="message-timestamp">{formatTime(message.timestamp)}</span>
      </div>

      {/* Card */}
      <div
        className={[
          "message-card",
          isUser ? "user" : "assistant",
          message.status === "error" ? "error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Loading states */}
        {!isUser && message.status === "pending" && (
          <div className="message-loader">
            <div className="dots"><span /><span /><span /></div>
            <span className="message-loader-text">Initializing...</span>
          </div>
        )}

        {!isUser && message.status === "routing" && (
          <div className="message-loader">
            <div className="dots"><span /><span /><span /></div>
            <span className="message-loader-text">Routing to best chapter...</span>
          </div>
        )}

        {!isUser && message.status === "generating" && (
          <div className="message-loader">
            <div className="dots"><span /><span /><span /></div>
            <span className="message-loader-text">
              {meta
                ? `Consulting ${meta.fullName}...`
                : "Generating response..."}
            </span>
          </div>
        )}

        {/* Error */}
        {message.status === "error" && (
          <p className="error-msg">
            {message.errorText ?? "An error occurred."}
          </p>
        )}

        {/* Content */}
        {message.content && (
          <p className="message-text">{message.content}</p>
        )}
      </div>

      {/* Routing panel — assistant only, when done */}
      {!isUser && message.status === "done" && message.routing && (
        <RoutingPanel routing={message.routing} />
      )}
    </div>
  );
}
