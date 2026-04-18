import { useChatStore } from "@/store/chatStore";
import type { ProcessStatus } from "@/types";

// ─────────────────────────────────────────────────────────────
//  SystemCheck — friendly startup screen
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

const FEATURES = [
  {
    icon: "ॐ",
    title: "Ancient Wisdom",
    desc: "Grounded in the Bhagavad Gita's teachings on grief, resilience, purpose, and mindfulness.",
  },
  {
    icon: "♡",
    title: "Hear a Loved One's Voice",
    desc: "Upload a short audio clip of someone dear to you and hear the guidance in their voice.",
  },
  {
    icon: "◎",
    title: "Fully Private",
    desc: "Everything runs on your device. No internet. No accounts. Your words never leave this computer.",
  },
];

export function SystemCheck() {
  const { processStatus, processStatusMessage, systemStatus } = useChatStore();
  const isError = processStatus === "error";
  const isIndeterminate =
    processStatus !== "idle" &&
    processStatus !== "ready" &&
    processStatus !== "error";
  const pct = progressFor(processStatus);

  // Friendly label for each loading phase
  function getLoadingLabel(): string {
    if (processStatusMessage) {
      if (processStatusMessage.toLowerCase().includes("embeddings"))
        return "Preparing the wisdom library…";
      if (processStatusMessage.toLowerCase().includes("router"))
        return "Learning how to guide you…";
      if (processStatusMessage.toLowerCase().includes("starting") ||
          processStatusMessage.toLowerCase().includes("initializing"))
        return "Starting up…";
      if (processStatusMessage.toLowerCase().includes("base model") ||
          processStatusMessage.toLowerCase().includes("lora"))
        return "Loading AI models…";
    }
    switch (processStatus) {
      case "idle":               return "Starting up…";
      case "initializing":       return "Starting up…";
      case "loading_embeddings": return "Preparing the wisdom library…";
      case "loading_router":     return "Learning how to guide you…";
      case "ready":              return "Ready";
      default:                   return "Starting up…";
    }
  }

  return (
    <div className="syscheck-wrap">
      <div className="syscheck-frame">

        {/* Title */}
        <div>
          <h1 className="syscheck-title">Gita Companion</h1>
          <div><p className="syscheck-sub">
            A private mental health companion rooted in Bhagavad Gita wisdom
          </p></div>
        </div>

        {/* Feature cards */}
        {!isError && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              margin: "8px 0",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  padding: "12px 14px",
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(0,0,0,0.02)",
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    lineHeight: 1,
                    flexShrink: 0,
                    marginTop: 2,
                    fontFamily: "serif",
                    opacity: 0.7,
                  }}
                  aria-hidden
                >
                  {f.icon}
                </span>
                <div>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: "var(--ink)",
                      marginBottom: 3,
                    }}
                  >
                    {f.title.toUpperCase()}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      color: "var(--ink)",
                      opacity: 0.65,
                      lineHeight: 1.5,
                    }}
                  >
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {!isError && (
          <div className="progress-wrap">
            <div className="progress-track">
              <div
                className={`progress-fill${isIndeterminate ? " indeterminate" : ""}`}
                style={isIndeterminate ? undefined : { width: `${pct}%` }}
              />
            </div>
            <p className="progress-label">{getLoadingLabel()}</p>
          </div>
        )}

        {/* Error — still keep it simple, no file names */}
        {isError && (
          <div className="syscheck-error">
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {systemStatus && !systemStatus.allReady
                ? "Some required files are missing. Make sure gita-companion.exe is in the same folder as all the other app files."
                : processStatusMessage || "Something went wrong while starting up."}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}