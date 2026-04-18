// ─────────────────────────────────────────────────────────────
//  src-tauri/src/commands/audio.rs
// ─────────────────────────────────────────────────────────────
use std::env;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::AppHandle;

use crate::commands::system::exe_dir;

#[tauri::command]
pub async fn generate_voice(
    app: AppHandle,
    text: String,
    ref_path: String,
) -> Result<String, String> {
    let base = exe_dir(&app);

    #[cfg(target_os = "windows")]
    let cloner_exe = base.join("voice_cloner.exe");
    #[cfg(not(target_os = "windows"))]
    let cloner_exe = base.join("voice_cloner");

    if !cloner_exe.exists() {
        return Err(format!(
            "Voice cloner not found at: {}",
            cloner_exe.display()
        ));
    }

    // Generate a unique output path in the OS temp directory
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let out_path = env::temp_dir().join(format!("gita_voice_{}.wav", timestamp));

    let mut cmd = Command::new(&cloner_exe);
    cmd.arg("--audio")
        .arg(&ref_path)
        .arg("--text")
        .arg(&text)
        .arg("--output")
        .arg(&out_path)
        .current_dir(&base)
        .env("PYTHONIOENCODING", "utf-8");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // Prevents a brief command prompt window from flashing

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute cloner: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Voice cloner failed: {}", err_msg));
    }

    Ok(out_path.to_string_lossy().to_string())
}
