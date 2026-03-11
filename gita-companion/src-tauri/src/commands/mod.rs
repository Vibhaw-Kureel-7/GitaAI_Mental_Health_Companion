// ─────────────────────────────────────────────────────────────
//  commands/mod.rs — re-export all Tauri commands
// ─────────────────────────────────────────────────────────────

pub mod ai;
pub mod system;

pub use ai::{ask_question, init_process, kill_process};
pub use system::check_system;
