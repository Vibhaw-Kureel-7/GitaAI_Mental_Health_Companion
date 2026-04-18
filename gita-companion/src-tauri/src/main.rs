// Prevents the extra console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

use commands::{ask_question, check_system, generate_voice, init_process, kill_process};
use state::AppState;
use tauri::Manager;

// ─────────────────────────────────────────────────────────────
//  main — configure and run the Tauri application
// ─────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            check_system,
            init_process,
            ask_question,
            kill_process,
            generate_voice
        ])
        .on_window_event(|window, event| {
            // Kill the child process cleanly when the window is destroyed
            if let tauri::WindowEvent::Destroyed = event {
                let state: tauri::State<'_, AppState> = window.app_handle().state();
                if let Ok(mut guard) = state.process.try_lock() {
                    if let Some(ref mut handle) = *guard {
                        let _ = handle.child.kill();
                    }
                    *guard = None;
                };
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
