// ─────────────────────────────────────────────────────────────
//  commands/system.rs — check required files before starting
// ─────────────────────────────────────────────────────────────

use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStatus {
    pub exe_found: bool,
    pub embeddings_found: bool,
    pub adapters_found: HashMap<String, bool>,
    pub all_ready: bool,
}

/// Returns the directory that contains gita_ai.exe by checking
/// several candidate locations in priority order:
///
///   1. Tauri resource dir         (production bundle)
///   2. Directory of this binary   (production fallback)
///   3. Current working directory  (dev: gita-companion/)
///   4. Parent of cwd              (dev: folder above gita-companion/)
///   5. Grandparent of cwd         (one more level up, just in case)
///
/// Returns the first directory where gita_ai.exe is actually found,
/// or the current working directory as a last resort.
pub fn exe_dir(app: &AppHandle) -> PathBuf {
    let candidates: Vec<PathBuf> = vec![
        // 1. Tauri resource directory (correct in production)
        app.path().resource_dir().unwrap_or_default(),
        // 2. Directory of the running binary
        std::env::current_exe()
            .unwrap_or_default()
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .to_path_buf(),
        // 3. Current working directory (gita-companion/ in dev)
        std::env::current_dir().unwrap_or_default(),
        // 4. Parent of cwd (the workspace root in dev, e.g. 9-3-26-2/)
        std::env::current_dir()
            .unwrap_or_default()
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .to_path_buf(),
        // 5. Grandparent of cwd
        std::env::current_dir()
            .unwrap_or_default()
            .parent()
            .and_then(|p| p.parent())
            .unwrap_or_else(|| std::path::Path::new("."))
            .to_path_buf(),
    ];

    for candidate in &candidates {
        if candidate.join(GITA_AI_EXE).exists() {
            return candidate.clone();
        }
    }

    // Fallback: current working directory
    std::env::current_dir().unwrap_or_default()
}

#[cfg(target_os = "windows")]
pub const GITA_AI_EXE: &str = "gita_ai.exe";
#[cfg(not(target_os = "windows"))]
pub const GITA_AI_EXE: &str = "gita_ai";

const ADAPTER_NAMES: &[&str] = &[
    "lora_adapters_LLM1",
    "lora_adapters_LLM2",
    "lora_adapters_LLM3",
    "lora_adapters_LLM6",
];

/// Tauri command: verify all required external files are present.
#[tauri::command]
pub fn check_system(app: AppHandle) -> SystemStatus {
    let base = exe_dir(&app);

    let exe_found = base.join(GITA_AI_EXE).exists();
    let embeddings_found = base.join("router_embeddings.pkl").exists();

    let mut adapters_found = HashMap::new();
    for name in ADAPTER_NAMES {
        adapters_found.insert((*name).to_string(), base.join(name).is_dir());
    }

    let all_ready = exe_found && embeddings_found && adapters_found.values().all(|&v| v);

    SystemStatus {
        exe_found,
        embeddings_found,
        adapters_found,
        all_ready,
    }
}
