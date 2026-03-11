import { useChatStore } from "@/store/chatStore";
import type { ProcessStatus } from "@/types";

// ─────────────────────────────────────────────────────────────
//  StatusBar — bottom chrome bar
// ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProcessStatus, string> = {
  idle:               "Idle",
  initializing:       "Initializing...",
  loading_embeddings: "Loading embeddings...",
  loading_router:     "Loading router model...",
  ready:              "Ready",
  processing:         "Processing...",
  error:              "Error",
};

function dotClass(s: ProcessStatus): string {
  if (s === "ready") return "ready";
  if (s === "processing") return "processing";
  if (s === "error") return "error";
  if (s === "idle") return "idle";
  return "init";
}

export function StatusBar() {
  const { processStatus, processStatusMessage } = useChatStore();
  const label = processStatusMessage || STATUS_LABELS[processStatus] || processStatus;

  return (
    <footer className="status-bar" role="status" aria-live="polite">
      <div className={`status-dot ${dotClass(processStatus)}`} aria-hidden />
      <span className="status-text">{label}</span>

      <div className="status-sep" aria-hidden />
      <span className="status-badge highlight">Offline</span>

      <div className="status-sep" aria-hidden />
      <span className="status-badge">Llama 3.2 1B + LoRA</span>

      <div className="status-sep" aria-hidden />
      <span className="status-badge">Full Privacy</span>
    </footer>
  );
}
