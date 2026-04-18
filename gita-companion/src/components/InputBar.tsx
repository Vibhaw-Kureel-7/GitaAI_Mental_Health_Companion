import { useRef, useState, KeyboardEvent, ChangeEvent } from "react";
import { useChatStore } from "@/store/chatStore";
import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  onSend: (text: string) => void;
}

// ─────────────────────────────────────────────────────────────
//  InputBar — textarea + send + voice cloning section
// ─────────────────────────────────────────────────────────────

export function InputBar({ onSend }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { processStatus, referenceVoicePath, setReferenceVoicePath } =
    useChatStore();

  const isReady = processStatus === "ready" || processStatus === "processing";
  const isBusy = processStatus === "processing";
  const canSend = isReady && !isBusy && value.trim().length > 0;

  // Extract just the filename from the full path
  const fileName = referenceVoicePath
    ? (referenceVoicePath.split(/[/\\]/).pop() ?? referenceVoicePath)
    : null;

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

  async function handleVoiceUpload() {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Audio",
          extensions: ["wav", "mp3", "flac"],
        },
      ],
    });
    if (selected && typeof selected === "string") {
      setReferenceVoicePath(selected);
    }
  }

  function getPlaceholder(): string {
    if (processStatus === "initializing") return "Loading AI models...";
    if (processStatus === "loading_embeddings") return "Loading embeddings...";
    if (processStatus === "loading_router") return "Loading router...";
    if (processStatus === "error") return "System error — check status bar";
    if (isBusy) return "Processing...";
    return "What is on your mind?";
  }

  return (
    <div className="input-area">
      {/* ── Voice Cloning Section ───────────────────────────── */}
      {referenceVoicePath ? (
        // Active: orange banner showing whose voice is loaded
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 14px",
            marginBottom: 10,
            border: "2px solid var(--fire)",
            background: "rgba(200, 90, 10, 0.07)",
            boxShadow: "2px 2px 0 var(--fire)",
          }}
        >
          {/* Note icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--fire)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ flexShrink: 0 }}
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink)",
              }}
            >
              Hearing responses as{" "}
              <strong
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 200,
                  display: "inline-block",
                  verticalAlign: "bottom",
                }}
                title={referenceVoicePath}
              >
                {fileName}
              </strong>
            </span>
          </div>

          <button
            onClick={() => setReferenceVoicePath(null)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              border: "1px solid var(--ink)",
              background: "none",
              cursor: "pointer",
              padding: "3px 10px",
              color: "var(--ink)",
              flexShrink: 0,
              letterSpacing: "0.05em",
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        // Inactive: clear invite to upload
        <button
          onClick={handleVoiceUpload}
          disabled={!isReady || isBusy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "8px 14px",
            marginBottom: 10,
            border: "1px dashed var(--smoke-dark, rgba(0,0,0,0.25))",
            background: "transparent",
            cursor: isReady && !isBusy ? "pointer" : "default",
            color: "var(--fog-dark, rgba(0,0,0,0.4))",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.04em",
            opacity: isReady && !isBusy ? 1 : 0.5,
            textAlign: "left",
          }}
          title="Upload a short audio clip of your loved one's voice"
        >
          {/* Music note icon */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ flexShrink: 0 }}
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Hear responses in a loved one's voice — upload an audio clip
        </button>
      )}

      {/* ── Input wrapper ───────────────────────────────────── */}
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
        Enter to send &nbsp;&middot;&nbsp; Shift+Enter for new line
        &nbsp;&middot;&nbsp; Fully offline — no data leaves this device
      </p>
    </div>
  );
}
