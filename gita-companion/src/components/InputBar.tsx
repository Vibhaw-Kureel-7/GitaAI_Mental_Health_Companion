import { useRef, useState, KeyboardEvent, ChangeEvent } from "react";
import { useChatStore } from "@/store/chatStore";

interface Props {
  onSend: (text: string) => void;
}

// ─────────────────────────────────────────────────────────────
//  InputBar — auto-expanding textarea + send button
// ─────────────────────────────────────────────────────────────

export function InputBar({ onSend }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { processStatus } = useChatStore();

  const isReady = processStatus === "ready" || processStatus === "processing";
  const isBusy  = processStatus === "processing";
  const canSend = isReady && !isBusy && value.trim().length > 0;

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    autoResize();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    if (!canSend) return;
    const text = value.trim();
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend(text);
  }

  function getPlaceholder(): string {
    if (processStatus === "initializing")       return "Loading AI models...";
    if (processStatus === "loading_embeddings") return "Loading embeddings...";
    if (processStatus === "loading_router")     return "Loading router...";
    if (processStatus === "error")              return "System error — check status bar";
    if (isBusy)                                 return "Processing...";
    return "What is on your mind?";
  }

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          className="input-field"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={!isReady || isBusy}
          rows={1}
          aria-label="Message input"
        />

        <button
          className="btn-send"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
          title="Send (Enter)"
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <polyline points="3,11 8,4 13,11" />
            <line x1="8" y1="4" x2="8" y2="14" />
          </svg>
        </button>
      </div>

      <p className="input-hint">
        Enter to send &nbsp;&middot;&nbsp; Shift+Enter for new line &nbsp;&middot;&nbsp; Fully offline — no data leaves this device
      </p>
    </div>
  );
}
