import { useChatStore } from "@/store/chatStore";
import type { ProcessStatus } from "@/types";

// ─────────────────────────────────────────────────────────────
//  SystemCheck — startup / loading screen
// ─────────────────────────────────────────────────────────────

function progressFor(status: ProcessStatus): number {
  switch (status) {
    case "idle":               return 0;
    case "initializing":       return 10;
    case "loading_embeddings": return 40;
    case "loading_router":     return 72;
    case "ready":              return 100;
    case "processing":         return 100;
    case "error":              return 100;
    default:                   return 0;
  }
}

export function SystemCheck() {
  const { processStatus, processStatusMessage, systemStatus } = useChatStore();
  const isError       = processStatus === "error";
  const isIndeterminate =
    processStatus !== "idle" &&
    processStatus !== "ready" &&
    processStatus !== "error";
  const pct = progressFor(processStatus);

  return (
    <div className="syscheck-wrap">
      <div className="syscheck-frame">
        {/* Title */}
        <div>
          <h1 className="syscheck-title">Gita Companion</h1>
          <p className="syscheck-sub">Bhagavad Gita AI &nbsp;&middot;&nbsp; Fully Offline</p>
        </div>

        {/* File check list */}
        {systemStatus && (
          <div>
            <p className="label" style={{ marginBottom: "var(--s-3)" }}>
              Required files
            </p>
            <div className="check-list">
              <FileRow label="gita_ai.exe"            ok={systemStatus.exeFound} />
              <FileRow label="router_embeddings.pkl"  ok={systemStatus.embeddingsFound} />
              {Object.entries(systemStatus.adaptersFound).map(([name, ok]) => (
                <FileRow key={name} label={name} ok={ok} />
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {!isError && (
          <div className="progress-wrap">
            <div className="progress-track">
              <div
                className={`progress-fill${isIndeterminate ? " indeterminate" : ""}`}
                style={isIndeterminate ? undefined : { width: `${pct}%` }}
              />
            </div>
            <p className="progress-label">
              {processStatusMessage || "Initializing..."}
            </p>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="syscheck-error">
            <p>{processStatusMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FileRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="check-item">
      <span className={`check-icon ${ok ? "ok" : "fail"}`} aria-hidden>
        {ok ? "+" : "x"}
      </span>
      <span className={`check-label ${ok ? "ok" : "fail"}`}>{label}</span>
    </div>
  );
}
