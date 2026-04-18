// ─────────────────────────────────────────────────────────────
//  state.rs — shared Tauri application state
// ─────────────────────────────────────────────────────────────

use std::process::Child;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

pub type LineSender = mpsc::Sender<String>;
pub type LineReceiver = mpsc::Receiver<String>;

/// Handle to the running gita_ai.exe child process.
pub struct ProcessHandle {
    /// The child process — kept alive; killed on window close.
    pub child: Child,
    /// Write end of the child's stdin.
    pub stdin: std::process::ChildStdin,
    /// Channel receiver for stdout lines.
    /// Mutex ensures only one command reads at a time.
    pub line_rx: Arc<Mutex<LineReceiver>>,
    /// True once "System ready!" has been received.
    pub ready: bool,
}

/// Single shared state object registered with Tauri.
pub struct AppState {
    pub process: Mutex<Option<ProcessHandle>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }
}
