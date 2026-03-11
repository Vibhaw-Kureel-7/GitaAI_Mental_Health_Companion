import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useChatStore } from "@/store/chatStore";
import type { AskResponse, StreamLineEvent } from "@/types";

// ─────────────────────────────────────────────────────────────
//  useChat — main chat logic
//
//  Exposes sendMessage and subscribes to stream-line events.
// ─────────────────────────────────────────────────────────────

export function useChat() {
  const {
    processStatus,
    addUserMessage,
    addAssistantPlaceholder,
    updateMessageStatus,
    finalizeAssistantMessage,
    setMessageError,
    appendStreamLine,
    clearStreamLines,
    setProcessStatus,
    newConversation,
    activeConversationId,
  } = useChatStore();

  const isProcessingRef = useRef(false);

  // Subscribe to streaming line events
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<StreamLineEvent>("stream-line", (event) => {
      if (
        event.payload.lineType === "response" ||
        event.payload.lineType === "routing"
      ) {
        appendStreamLine(event.payload.line);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (isProcessingRef.current) return;
      if (processStatus !== "ready" && processStatus !== "processing") return;

      isProcessingRef.current = true;

      if (!activeConversationId) {
        newConversation();
      }

      clearStreamLines();
      addUserMessage(trimmed);

      const assistantId = addAssistantPlaceholder();
      updateMessageStatus(assistantId, "routing");
      setProcessStatus("processing", "Routing question...");

      try {
        const result = await invoke<AskResponse>("ask_question", {
          question: trimmed,
        });

        finalizeAssistantMessage(
          assistantId,
          result.responseText,
          result.routing
        );
        setProcessStatus("ready", "Ready");
      } catch (e) {
        const errorText =
          typeof e === "string" ? e : "An unexpected error occurred.";
        setMessageError(assistantId, errorText);
        setProcessStatus("ready", "Ready");
      } finally {
        isProcessingRef.current = false;
      }
    },
    [processStatus, activeConversationId]
  );

  return {
    sendMessage,
    isProcessing: isProcessingRef.current,
  };
}
