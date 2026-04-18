import { create } from "zustand";
import type {
  Conversation,
  Message,
  MessageStatus,
  ProcessStatus,
  RoutingResult,
  SystemStatus,
} from "@/types";

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateTitle(firstMessage: string): string {
  return firstMessage.length > 42
    ? firstMessage.slice(0, 42).trimEnd() + "..."
    : firstMessage;
}

// ─────────────────────────────────────────────────────────────
//  Store shape
// ─────────────────────────────────────────────────────────────

interface ChatState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;

  // System
  processStatus: ProcessStatus;
  processStatusMessage: string;
  systemStatus: SystemStatus | null;

  // Streaming
  streamingMessageId: string | null;
  streamLines: string[];

  // UI
  sidebarOpen: boolean;

  // Audio / voice cloning
  referenceVoicePath: string | null;
  setReferenceVoicePath: (path: string | null) => void;
  attachAudioToMessage: (id: string, audioUrl: string) => void;
  setMessageAudioSynthesizing: (id: string, synthesizing: boolean) => void;

  // Selectors
  getActiveConversation: () => Conversation | null;
  getActiveMessages: () => Message[];

  // Conversation actions
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearAllConversations: () => void;

  // Message actions
  addUserMessage: (content: string) => string;
  addAssistantPlaceholder: () => string;
  updateMessageStatus: (id: string, status: Message["status"]) => void;
  updateMessageContent: (id: string, content: string) => void;
  updateMessageRouting: (id: string, routing: RoutingResult) => void;
  finalizeAssistantMessage: (id: string, content: string, routing: RoutingResult) => void;
  setMessageError: (id: string, errorText: string) => void;

  // Process / system actions
  setProcessStatus: (status: ProcessStatus, message?: string) => void;
  setSystemStatus: (status: SystemStatus) => void;

  // Streaming
  setStreamingMessageId: (id: string | null) => void;
  appendStreamLine: (line: string) => void;
  clearStreamLines: () => void;

  // UI
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

// ─────────────────────────────────────────────────────────────
//  Store implementation
// ─────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  processStatus: "idle",
  processStatusMessage: "",
  systemStatus: null,
  streamingMessageId: null,
  streamLines: [],
  sidebarOpen: true,

  // ── Audio ──────────────────────────────────────────────────

  referenceVoicePath: null,

  setReferenceVoicePath: (path) => set({ referenceVoicePath: path }),

  attachAudioToMessage: (id, audioUrl) =>
    set((s) => ({
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === id ? { ...m, audioUrl } : m
        ),
      })),
    })),

  setMessageAudioSynthesizing: (id, synthesizing) =>
    set((s) => ({
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === id ? { ...m, audioSynthesizing: synthesizing } : m
        ),
      })),
    })),

  // ── Selectors ──────────────────────────────────────────────

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },

  getActiveMessages: () => {
    const conv = get().getActiveConversation();
    return conv?.messages ?? [];
  },

  // ── Conversation actions ───────────────────────────────────

  newConversation: () => {
    const id = generateId();
    const conv: Conversation = {
      id,
      title: "New conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversationId: id,
    }));
    return id;
  },

  selectConversation: (id) => set({ activeConversationId: id }),

  deleteConversation: (id) => {
    set((s) => {
      const filtered = s.conversations.filter((c) => c.id !== id);
      const nextActive =
        s.activeConversationId === id
          ? (filtered[0]?.id ?? null)
          : s.activeConversationId;
      return { conversations: filtered, activeConversationId: nextActive };
    });
  },

  clearAllConversations: () =>
    set({ conversations: [], activeConversationId: null }),

  // ── Message actions ────────────────────────────────────────

  addUserMessage: (content) => {
    let convId = get().activeConversationId;
    if (!convId) {
      convId = get().newConversation();
    }
    const msgId = generateId();
    const msg: Message = {
      id: msgId,
      role: "user",
      content,
      timestamp: Date.now(),
      status: "done",
    };
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          title: c.messages.length === 0 ? generateTitle(content) : c.title,
          messages: [...c.messages, msg],
          updatedAt: Date.now(),
        };
      }),
    }));
    return msgId;
  },

  addAssistantPlaceholder: () => {
    const convId = get().activeConversationId;
    const msgId = generateId();
    const msg: Message = {
      id: msgId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      status: "pending",
    };
    set((s) => ({
      streamingMessageId: msgId,
      conversations: s.conversations.map((c) => {
        if (c.id !== convId) return c;
        return { ...c, messages: [...c.messages, msg], updatedAt: Date.now() };
      }),
    }));
    return msgId;
  },

  updateMessageStatus: (id, status) => {
    set((s) => ({
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === id ? { ...m, status } : m)),
      })),
    }));
  },

  updateMessageContent: (id, content) => {
    set((s) => ({
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === id ? { ...m, content } : m)),
      })),
    }));
  },

  updateMessageRouting: (id, routing) => {
    set((s) => ({
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === id
            ? { ...m, routing, status: "generating" as MessageStatus }
            : m
        ),
      })),
    }));
  },

  finalizeAssistantMessage: (id, content, routing) => {
    set((s) => ({
      streamingMessageId: null,
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === id
            ? { ...m, content, routing, status: "done" as MessageStatus }
            : m
        ),
        updatedAt: Date.now(),
      })),
    }));
  },

  setMessageError: (id, errorText) => {
    set((s) => ({
      streamingMessageId: null,
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === id
            ? { ...m, status: "error" as MessageStatus, errorText }
            : m
        ),
      })),
    }));
  },

  // ── Process / system ───────────────────────────────────────

  setProcessStatus: (status, message = "") =>
    set({ processStatus: status, processStatusMessage: message }),

  setSystemStatus: (systemStatus) => set({ systemStatus }),

  // ── Streaming ──────────────────────────────────────────────

  setStreamingMessageId: (id) => set({ streamingMessageId: id }),
  appendStreamLine: (line) =>
    set((s) => ({ streamLines: [...s.streamLines, line] })),
  clearStreamLines: () => set({ streamLines: [] }),

  // ── UI ─────────────────────────────────────────────────────

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));