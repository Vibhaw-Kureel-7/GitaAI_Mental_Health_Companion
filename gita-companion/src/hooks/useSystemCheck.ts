import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useChatStore } from "@/store/chatStore";
import type { SystemStatus, StatusEvent } from "@/types";

// ─────────────────────────────────────────────────────────────
//  useSystemCheck
//
//  1. Listens for process-status events from Rust
//  2. Calls check_system to verify files on disk
//  3. Calls init_process to spawn gita_ai.exe --interactive
// ─────────────────────────────────────────────────────────────

export function useSystemCheck() {
  const { setSystemStatus, setProcessStatus } = useChatStore();

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    async function run() {
      // Subscribe to status events from Rust
      unlisten = await listen<StatusEvent>("process-status", (event) => {
        setProcessStatus(event.payload.status, event.payload.message);
      });

      // Check required files exist
      setProcessStatus("initializing", "Checking required files...");
      try {
        const sysStatus = await invoke<SystemStatus>("check_system");
        setSystemStatus(sysStatus);

        if (!sysStatus.allReady) {
          setProcessStatus(
            "error",
            "Required files are missing. Ensure gita_ai.exe, router_embeddings.pkl, and all lora_adapters_LLM* folders are in the same directory as this app."
          );
          return;
        }
      } catch (e) {
        setProcessStatus("error", `System check failed: ${e}`);
        return;
      }

      // Spawn the process — loads embeddings + sentence transformer
      try {
        await invoke("init_process");
      } catch (e) {
        setProcessStatus("error", `Failed to start AI process: ${e}`);
        return;
      }
    }

    run();

    return () => {
      unlisten?.();
    };
  }, []);
}
