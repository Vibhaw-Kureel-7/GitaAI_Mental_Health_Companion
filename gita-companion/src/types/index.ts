// ─────────────────────────────────────────────────────────────
//  Core domain types for Gita Companion
// ─────────────────────────────────────────────────────────────

export type LlmKey =
  | "LLM-1  (Chapter 1)"
  | "LLM-2  (Chapter 2)"
  | "LLM-3  (Chapter 3)"
  | "LLM-6  (Chapter 6)";

export interface LlmMeta {
  key: LlmKey;
  chapter: number;
  shortName: string;
  fullName: string;
  tradition: string;
  description: string;
  color: string;
}

export const LLM_META: Record<LlmKey, LlmMeta> = {
  "LLM-1  (Chapter 1)": {
    key: "LLM-1  (Chapter 1)",
    chapter: 1,
    shortName: "Vishada",
    fullName: "Chapter 1 — Vishada Yoga",
    tradition: "Crisis & Grief",
    description: "Panic, overwhelm, decision paralysis",
    color: "var(--accent-crisis)",
  },
  "LLM-2  (Chapter 2)": {
    key: "LLM-2  (Chapter 2)",
    chapter: 2,
    shortName: "Sankhya",
    fullName: "Chapter 2 — Sankhya Yoga",
    tradition: "Cognitive Resilience",
    description: "Expectations, reframing, emotional stability",
    color: "var(--accent-sankhya)",
  },
  "LLM-3  (Chapter 3)": {
    key: "LLM-3  (Chapter 3)",
    chapter: 3,
    shortName: "Karma",
    fullName: "Chapter 3 — Karma Yoga",
    tradition: "Action & Purpose",
    description: "Lethargy, burnout, duty without attachment",
    color: "var(--accent-karma)",
  },
  "LLM-6  (Chapter 6)": {
    key: "LLM-6  (Chapter 6)",
    chapter: 6,
    shortName: "Dhyana",
    fullName: "Chapter 6 — Dhyana Yoga",
    tradition: "Mindfulness",
    description: "Racing mind, overthinking, grounding",
    color: "var(--accent-dhyana)",
  },
};

// ─────────────────────────────────────────────────────────────
//  Routing result
// ─────────────────────────────────────────────────────────────

export interface RoutingScore {
  llmKey: LlmKey;
  score: number;
  pct: number;
  selected: boolean;
}

export interface RoutingResult {
  scores: RoutingScore[];
  selectedKey: LlmKey;
  confidence: number;
  votes: number;
  totalVotes: number;
}

// ─────────────────────────────────────────────────────────────
//  Message / conversation
// ─────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";
export type MessageStatus = "pending" | "routing" | "generating" | "done" | "error";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  status: MessageStatus;
  routing?: RoutingResult;
  errorText?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ─────────────────────────────────────────────────────────────
//  Process / system state
// ─────────────────────────────────────────────────────────────

export type ProcessStatus =
  | "idle"
  | "initializing"
  | "loading_embeddings"
  | "loading_router"
  | "ready"
  | "processing"
  | "error";

export interface SystemStatus {
  exeFound: boolean;
  embeddingsFound: boolean;
  adaptersFound: Record<string, boolean>;
  allReady: boolean;
}

// ─────────────────────────────────────────────────────────────
//  Tauri IPC payloads
// ─────────────────────────────────────────────────────────────

export interface AskResponse {
  routing: RoutingResult;
  responseText: string;
}

export interface StatusEvent {
  status: ProcessStatus;
  message: string;
}

export interface StreamLineEvent {
  line: string;
  lineType: "routing" | "response" | "status" | "separator" | "other";
}
