// ─────────────────────────────────────────────────────────────
//  commands/ai.rs
//
//  Manages the persistent gita_ai.exe --interactive child process.
//  Communication is via stdin / stdout line-based IPC.
//
//  Protocol:
//    Startup:  ready when a line contains "System ready!"
//    Per-turn: write question\n to stdin, collect stdout until
//              the ─────── separator line following "AI Response:"
//    Routing:  lines with "LLM-" and "%" are score rows;
//              lines with "Routed to" carry the selected key;
//              lines with "Confidence:" carry confidence + votes.
// ─────────────────────────────────────────────────────────────

use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Duration;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt; 
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, Mutex};

use crate::commands::system::{exe_dir, GITA_AI_EXE};
use crate::state::{AppState, ProcessHandle};

// ── Response types ────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LlmScore {
    pub llm_key:  String,
    pub pct:      f32,
    pub score:    f32,
    pub selected: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoutingResult {
    pub scores:       Vec<LlmScore>,
    pub selected_key: String,
    pub confidence:   u32,
    pub votes:        u32,
    pub total_votes:  u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AskResponse {
    pub routing:       RoutingResult,
    pub response_text: String,
}

// ── Line parsing ──────────────────────────────────────────────

/// True if the line consists entirely of U+2500 BOX DRAWINGS LIGHT HORIZONTAL
fn is_separator(line: &str) -> bool {
    let chars: Vec<char> = line.chars().collect();
    chars.len() >= 20 && chars.iter().all(|&c| c == '\u{2500}')
}

/// Parse:  |  LLM-1 (Chapter 1 · Vishada / Crisis)   73.3%  ████  SELECTED
fn parse_score_line(line: &str) -> Option<LlmScore> {
    if !line.starts_with('\u{2502}') { return None; }
    if !line.contains('%')           { return None; }
    if !line.contains("LLM-")        { return None; }

    let selected = line.contains("SELECTED");

    let pct_re = regex::Regex::new(r"(\d+\.?\d*)%").ok()?;
    let pct: f32 = pct_re.captures(line)?.get(1)?.as_str().parse().ok()?;

    let key_re = regex::Regex::new(r"(LLM-\d+\s+\(Chapter \d+[^)]*\))").ok()?;
    let llm_key = key_re.captures(line)?.get(1)?.as_str().trim().to_string();

    Some(LlmScore { llm_key, pct, score: pct / 100.0, selected })
}

/// Parse:  |  Routed to : LLM-1 (Chapter 1 · ...)
fn parse_selected_line(line: &str) -> Option<String> {
    if !line.contains("Routed to") { return None; }
    let key_re = regex::Regex::new(r"(LLM-\d+\s+\(Chapter \d+[^)]*\))").ok()?;
    Some(key_re.captures(line)?.get(1)?.as_str().trim().to_string())
}

/// Parse:  |  Confidence: 60%  (3/5 votes)
fn parse_confidence_line(line: &str) -> Option<(u32, u32, u32)> {
    if !line.contains("Confidence:") { return None; }
    let pct_re  = regex::Regex::new(r"(\d+)%").ok()?;
    let vote_re = regex::Regex::new(r"\((\d+)/(\d+)").ok()?;
    let pct: u32  = pct_re.captures(line)?.get(1)?.as_str().parse().ok()?;
    let caps      = vote_re.captures(line)?;
    let votes: u32 = caps.get(1)?.as_str().parse().ok()?;
    let total: u32 = caps.get(2)?.as_str().parse().ok()?;
    Some((pct, votes, total))
}

// ── Event helpers ─────────────────────────────────────────────

fn emit_status(app: &AppHandle, status: &str, message: &str) {
    let _ = app.emit(
        "process-status",
        serde_json::json!({ "status": status, "message": message }),
    );
}

fn emit_stream_line(app: &AppHandle, line: &str, line_type: &str) {
    let _ = app.emit(
        "stream-line",
        serde_json::json!({ "line": line, "lineType": line_type }),
    );
}

fn classify_line(line: &str, in_response: bool) -> &'static str {
    if in_response {
        if is_separator(line) { "separator" } else { "response" }
    } else if line.contains("LLM-") && line.contains('%') {
        "routing"
    } else if line.contains("Routed to") || line.contains("Confidence") {
        "routing"
    } else if is_separator(line) {
        "separator"
    } else {
        "status"
    }
}

/// Map meaningful startup lines to frontend status events.
fn handle_startup_line(app: &AppHandle, line: &str) {
    if line.contains("Loading router embeddings") {
        emit_status(app, "loading_embeddings", "Loading routing embeddings...");
    } else if line.contains("Embeddings loaded") {
        emit_status(app, "loading_embeddings", "Embeddings loaded.");
    } else if line.contains("Loading sentence-transformer") {
        emit_status(app, "loading_router", "Loading router model...");
    } else if line.contains("Router ready") {
        emit_status(app, "loading_router", "Router ready.");
    } else if line.contains("Loading base model") {
        emit_status(app, "processing", "Loading base model (first run may download)...");
    } else if line.contains("Attaching LoRA") {
        emit_status(app, "processing", "Attaching LoRA adapter...");
    } else if line.contains("System ready!") {
        emit_status(app, "ready", "Ready");
    }
}

// ── init_process ─────────────────────────────────────────────

/// Spawn gita_ai.exe --interactive and wait for "System ready!".
/// A background thread reads all stdout into an mpsc channel.
/// A second thread captures stderr and surfaces errors to the frontend.
#[tauri::command]
pub async fn init_process(
    app:   AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let base     = exe_dir(&app);
    let exe_path = base.join(GITA_AI_EXE);

    if !exe_path.exists() {
        return Err(format!(
            "gita_ai executable not found: {}",
            exe_path.display()
        ));
    }

    emit_status(&app, "initializing", "Starting AI process...");

    let mut cmd = Command::new(&exe_path);
    cmd.arg("--interactive")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&base)
        .env("PYTHONUNBUFFERED", "1")
        .env("PYTHONIOENCODING", "utf-8");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn gita_ai: {e}"))?;
    
    let stdout = child.stdout.take().ok_or("Could not capture stdout")?;
    let stderr = child.stderr.take().ok_or("Could not capture stderr")?;
    let stdin  = child.stdin.take().ok_or("Could not capture stdin")?;

    // Shared stderr accumulator so we can include it in error messages
    let stderr_lines: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let stderr_lines_thread = Arc::clone(&stderr_lines);

    let (tx, rx) = mpsc::channel::<String>(1024);
    let app_clone = app.clone();

    // Thread 1: drain stdout into mpsc channel + fire startup status events
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                handle_startup_line(&app_clone, &l);
                let _ = tx.blocking_send(l);
            }
        }
    });

    // Thread 2: drain stderr, store lines, and forward non-trivial ones to frontend
    let app_stderr = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                let trimmed = l.trim().to_string();
                if trimmed.is_empty() { continue; }

                if let Ok(mut v) = stderr_lines_thread.try_lock() {
                    v.push(trimmed.clone());
                    if v.len() > 20 { v.remove(0); }
                }

                let is_warning = trimmed.contains("UserWarning")
                    || trimmed.contains("FutureWarning")
                    || trimmed.contains("DeprecationWarning")
                    || trimmed.starts_with("warnings.warn")
                    || trimmed.contains("torch_dtype")
                    || trimmed.starts_with("Loading weights")
                    || trimmed.contains("UNEXPECTED");

                if !is_warning && !trimmed.contains("\u{1b}[") {
                    emit_status(&app_stderr, "initializing", &trimmed);
                }
            }
        }
    });

    let line_rx = Arc::new(Mutex::new(rx));
    let deadline = std::time::Instant::now() + Duration::from_secs(600);

    // Wait for ready signal
    loop {
        if std::time::Instant::now() > deadline {
            return Err("Timed out waiting for gita_ai to become ready".into());
        }
        let line = {
            let mut rx = line_rx.lock().await;
            match tokio::time::timeout(Duration::from_secs(30), rx.recv()).await {
                Ok(Some(l)) => l,
                Ok(None)    => {
                    // Process exited — collect stderr for the error message
                    let err_detail = {
                        let v = stderr_lines.lock().await;
                        if v.is_empty() {
                            "No error output captured. The exe may be missing a dependency or crashed silently.".to_string()
                        } else {
                            v.join(" | ")
                        }
                    };
                    return Err(format!("gita_ai exited during startup. Last stderr: {err_detail}"));
                },
                Err(_) => {
                    // 30-second timeout on a single line — likely hung
                    let err_detail = {
                        let v = stderr_lines.lock().await;
                        v.join(" | ")
                    };
                    return Err(format!("gita_ai stopped producing output. stderr: {err_detail}"));
                },
            }
        };
        if line.contains("System ready!") || line.contains("Router ready") {
            emit_status(&app, "ready", "Ready");
            break;
        }
    }

    let mut guard = state.process.lock().await;
    *guard = Some(ProcessHandle { child, stdin, line_rx, ready: true });

    Ok(())
}

// ── ask_question ─────────────────────────────────────────────

/// Send a question to gita_ai and parse the full structured response.
#[tauri::command]
pub async fn ask_question(
    app:      AppHandle,
    state:    State<'_, AppState>,
    question: String,
) -> Result<AskResponse, String> {
    let mut guard = state.process.lock().await;
    let handle = guard
        .as_mut()
        .ok_or("AI process is not running. Call init_process first.")?;

    if !handle.ready {
        return Err("AI process is not ready yet.".into());
    }

    emit_status(&app, "processing", "Routing question...");

    // Write question to stdin
    handle
        .stdin
        .write_all(format!("{}\n", question.trim()).as_bytes())
        .map_err(|e| format!("Failed to write to stdin: {e}"))?;
    handle
        .stdin
        .flush()
        .map_err(|e| format!("Failed to flush stdin: {e}"))?;

    // Collect output
    let mut scores:       Vec<LlmScore> = Vec::new();
    let mut selected_key  = String::new();
    let mut confidence    = 0u32;
    let mut votes         = 0u32;
    let mut total_votes   = 0u32;
    let mut response_lines: Vec<String> = Vec::new();
    let mut in_response   = false;
    let mut sep_after_response = 0usize;

    let deadline = std::time::Instant::now() + Duration::from_secs(300);

    loop {
        if std::time::Instant::now() > deadline {
            return Err("Response timed out".into());
        }

        let line = {
            let mut rx = handle.line_rx.lock().await;
            match tokio::time::timeout(Duration::from_secs(180), rx.recv()).await {
                Ok(Some(l)) => l,
                Ok(None)    => return Err("gita_ai exited during response".into()),
                Err(_)      => return Err("Timed out waiting for response line".into()),
            }
        };

        // Skip the "You:" prompt line
        if line.contains('\u{2753}') && line.contains("You:") {
            continue;
        }

        let line_type = classify_line(&line, in_response);
        emit_stream_line(&app, &line, line_type);

        // Parse routing data
        if let Some(score) = parse_score_line(&line) {
            scores.push(score);
            continue;
        }
        if let Some(key) = parse_selected_line(&line) {
            selected_key = key;
            emit_status(&app, "processing", "Generating response...");
            continue;
        }
        if let Some((pct, v, t)) = parse_confidence_line(&line) {
            confidence  = pct;
            votes       = v;
            total_votes = t;
            continue;
        }

        // Detect start of response section
        if line.contains("AI Response:") {
            in_response = true;
            continue;
        }

        if in_response {
            if is_separator(&line) {
                sep_after_response += 1;
                if sep_after_response >= 1 {
                    break;
                }
            } else if !response_lines.is_empty() || !line.trim().is_empty() {
                response_lines.push(line);
            }
        }
    }

    // Build clean response text
    let raw = response_lines.join("\n").trim().to_string();
    let response_text = raw
        .trim_start_matches('\u{1F916}')
        .trim_start_matches("AI:")
        .trim_start_matches("A:") 
        .trim()
        .to_string();

    // Fallback: derive selected_key from scores if not explicitly parsed
    if selected_key.is_empty() {
        selected_key = scores
            .iter()
            .find(|s| s.selected)
            .map(|s| s.llm_key.clone())
            .unwrap_or_default();
    }

    // Ensure selected flag is consistent
    for s in &mut scores {
        s.selected = s.llm_key == selected_key;
    }

    let routing = RoutingResult {
        scores,
        selected_key,
        confidence,
        votes,
        total_votes,
    };

    emit_status(&app, "ready", "Ready");

    Ok(AskResponse { routing, response_text })
}

// ── kill_process ─────────────────────────────────────────────

/// Gracefully terminate gita_ai.exe.
#[tauri::command]
pub async fn kill_process(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.process.lock().await;
    if let Some(mut handle) = guard.take() {
        let _ = handle.child.kill();
    }
    Ok(())
}
