use crate::error::TraceLearningError;
use crate::transcript_discovery::{TranscriptSessionRoot, TranscriptSessionSource};
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::collections::{BTreeSet, HashSet};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

const BACKFILL_WINDOW_MS: i64 = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS: i64 = 30 * 60 * 1000;
const FAST_RECENT_TRANSCRIPTS: usize = 12;
const MAX_TRANSCRIPTS: usize = 48;

#[derive(Clone, Debug)]
pub struct TranscriptSessionBackfill {
    pub session_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub transcript_path: String,
    pub source: Option<String>,
    pub last_seen_at_ms: i64,
    pub status: String,
    pub turn_id: Option<String>,
    pub prompt: Option<String>,
    pub turn_started_at_ms: i64,
    pub recovered_events: Vec<TranscriptRecoveredEvent>,
}

#[derive(Clone, Debug)]
struct TranscriptTurnBackfill {
    turn_id: Option<String>,
    prompt: Option<String>,
    completed: bool,
    started_at_ms: i64,
    events: Vec<TranscriptRecoveredEvent>,
}

#[derive(Clone, Debug)]
pub enum TranscriptRecoveredEvent {
    FunctionCall {
        turn_id: Option<String>,
        observed_at_ms: i64,
        tool_name: String,
        arguments: String,
    },
}

pub fn collect_recent_transcript_summaries(
    repo_root: &Path,
) -> Result<Vec<TranscriptSessionBackfill>, TraceLearningError> {
    let session_roots = crate::discover_transcript_session_roots();
    if session_roots.is_empty() {
        return Ok(Vec::new());
    }

    let now_ms = Utc::now().timestamp_millis();
    let mut transcripts = collect_recent_transcripts(&session_roots)?;
    transcripts
        .retain(|(_, modified_ms)| now_ms.saturating_sub(*modified_ms) <= BACKFILL_WINDOW_MS);
    transcripts.sort_by(|a, b| b.1.cmp(&a.1));

    let recent_candidates = transcripts
        .iter()
        .filter(|(_, modified_ms)| now_ms.saturating_sub(*modified_ms) <= ACTIVE_WINDOW_MS)
        .take(FAST_RECENT_TRANSCRIPTS)
        .map(|(path, modified_ms)| (path.clone(), *modified_ms))
        .collect::<Vec<_>>();
    let recent_matches = parse_matching_transcript_summaries(
        &recent_candidates,
        repo_root,
        now_ms,
        ACTIVE_WINDOW_MS,
    );
    if !recent_matches.is_empty() {
        return Ok(recent_matches);
    }

    transcripts.truncate(MAX_TRANSCRIPTS);
    Ok(parse_matching_transcript_summaries(
        &transcripts,
        repo_root,
        now_ms,
        ACTIVE_WINDOW_MS,
    ))
}

pub fn collect_active_transcript_summaries(
    repo_root: &Path,
) -> Result<Vec<TranscriptSessionBackfill>, TraceLearningError> {
    let session_roots = crate::discover_transcript_session_roots();
    if session_roots.is_empty() {
        return Ok(Vec::new());
    }

    let now_ms = Utc::now().timestamp_millis();
    let mut transcripts = collect_recent_transcripts(&session_roots)?;
    transcripts
        .retain(|(_, modified_ms)| now_ms.saturating_sub(*modified_ms) <= BACKFILL_WINDOW_MS);
    transcripts.sort_by(|a, b| b.1.cmp(&a.1));

    let recent_candidates = transcripts
        .iter()
        .filter(|(_, modified_ms)| now_ms.saturating_sub(*modified_ms) <= ACTIVE_WINDOW_MS)
        .take(FAST_RECENT_TRANSCRIPTS)
        .map(|(path, modified_ms)| (path.clone(), *modified_ms))
        .collect::<Vec<_>>();

    Ok(parse_matching_transcript_summaries(
        &recent_candidates,
        repo_root,
        now_ms,
        ACTIVE_WINDOW_MS,
    ))
}

pub fn parse_matching_transcript_summaries(
    transcripts: &[(PathBuf, i64)],
    repo_root: &Path,
    now_ms: i64,
    active_window_ms: i64,
) -> Vec<TranscriptSessionBackfill> {
    let repo_root_text = repo_root.to_string_lossy().to_string();
    let mut summaries = Vec::new();

    for (path, modified_ms) in transcripts {
        let Some(summary) = parse_transcript_backfill(path, *modified_ms) else {
            continue;
        };
        if summary.cwd != repo_root_text {
            continue;
        }
        if summary.status != "active"
            && now_ms.saturating_sub(summary.last_seen_at_ms) > active_window_ms
        {
            continue;
        }
        summaries.push(summary);
    }

    summaries
}

pub fn collect_recent_transcripts(
    roots: &[TranscriptSessionRoot],
) -> Result<Vec<(PathBuf, i64)>, TraceLearningError> {
    let mut files = Vec::new();
    for root in roots {
        let mut root_files = match root.kind {
            TranscriptSessionSource::Codex => collect_recent_codex_transcripts(&root.path)?,
            TranscriptSessionSource::ClaudeProjects => {
                collect_recent_claude_project_transcripts(&root.path)?
            }
        };
        files.append(&mut root_files);
    }

    let mut deduped = Vec::new();
    let mut seen_paths = HashSet::new();
    for (path, modified_ms) in files {
        if seen_paths.insert(path.clone()) {
            deduped.push((path, modified_ms));
        }
    }

    Ok(deduped)
}

pub fn collect_recent_codex_transcripts(
    root: &Path,
) -> Result<Vec<(PathBuf, i64)>, TraceLearningError> {
    let mut stack = vec![root.to_path_buf()];
    collect_recent_transcripts_from_dirs(&mut stack)
}

pub fn collect_recent_claude_project_transcripts(
    root: &Path,
) -> Result<Vec<(PathBuf, i64)>, TraceLearningError> {
    let mut stack = vec![root.to_path_buf()];
    collect_recent_transcripts_from_dirs(&mut stack)
}

pub fn collect_recent_transcripts_from_dirs(
    dirs: &mut Vec<PathBuf>,
) -> Result<Vec<(PathBuf, i64)>, TraceLearningError> {
    let mut files = Vec::new();
    while let Some(dir) = dirs.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_dir() {
                dirs.push(path);
                continue;
            }
            if !file_type.is_file()
                || path.extension().and_then(|ext| ext.to_str()) != Some("jsonl")
            {
                continue;
            }
            let modified_ms = entry
                .metadata()
                .ok()
                .and_then(|meta| meta.modified().ok())
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|dur| dur.as_millis() as i64)
                .unwrap_or_default();
            files.push((path, modified_ms));
        }
    }
    Ok(files)
}

pub fn parse_transcript_backfill(
    transcript_path: &Path,
    modified_ms: i64,
) -> Option<TranscriptSessionBackfill> {
    let file = std::fs::File::open(transcript_path).ok()?;
    let reader = BufReader::new(file);
    let mut session_id = None;
    let mut cwd = None;
    let mut model = None;
    let mut source = None;
    let mut last_seen_at_ms = modified_ms;
    let mut current_turn = TranscriptTurnBackfill::default();
    let mut latest_turn = TranscriptTurnBackfill::default();

    for line in reader.lines() {
        let line = line.ok()?;
        let entry: Value = serde_json::from_str(&line).ok()?;
        let observed_at_ms = entry
            .get("timestamp")
            .and_then(Value::as_str)
            .and_then(parse_rfc3339_ms)
            .unwrap_or(last_seen_at_ms);
        last_seen_at_ms = observed_at_ms;

        match entry.get("type").and_then(Value::as_str) {
            Some("session_meta") => {
                let payload = entry.get("payload").cloned().unwrap_or(Value::Null);
                session_id = payload
                    .get("id")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
                cwd = payload
                    .get("cwd")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
                model = payload
                    .get("model")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
                    .or_else(|| {
                        payload
                            .get("model_provider")
                            .and_then(Value::as_str)
                            .map(|value| value.to_string())
                    });
                source = payload
                    .get("source")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
            }
            Some("event_msg") => match entry.pointer("/payload/type").and_then(Value::as_str) {
                Some("task_started") => {
                    if current_turn.turn_id.is_some() {
                        latest_turn = std::mem::take(&mut current_turn);
                    }
                    current_turn.turn_id = entry
                        .pointer("/payload/turn_id")
                        .and_then(Value::as_str)
                        .map(|value| value.to_string());
                    current_turn.prompt = None;
                    current_turn.completed = false;
                    current_turn.started_at_ms = observed_at_ms;
                }
                Some("user_message") if current_turn.turn_id.is_some() => {
                    current_turn.prompt = entry
                        .pointer("/payload/message")
                        .and_then(Value::as_str)
                        .map(|value| value.to_string());
                }
                Some("task_complete") => {
                    if entry.pointer("/payload/turn_id").and_then(Value::as_str)
                        == current_turn.turn_id.as_deref()
                    {
                        current_turn.completed = true;
                    }
                }
                _ => {}
            },
            Some("response_item")
                if entry.pointer("/payload/type").and_then(Value::as_str) == Some("message")
                    && entry.pointer("/payload/role").and_then(Value::as_str) == Some("user")
                    && current_turn.turn_id.is_some() =>
            {
                if let Some(message) = extract_user_prompt_from_response_item(&entry) {
                    current_turn.prompt = Some(message);
                }
            }
            Some("response_item")
                if entry.pointer("/payload/type").and_then(Value::as_str)
                    == Some("function_call")
                    && current_turn.turn_id.is_some() =>
            {
                let tool_name = entry.pointer("/payload/name").and_then(Value::as_str)?;
                let arguments = entry
                    .pointer("/payload/arguments")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !tool_name.is_empty() {
                    current_turn
                        .events
                        .push(TranscriptRecoveredEvent::FunctionCall {
                            turn_id: current_turn.turn_id.clone(),
                            observed_at_ms,
                            tool_name: tool_name.to_string(),
                            arguments,
                        });
                }
            }
            _ => {}
        }
    }

    let use_current_turn = current_turn.turn_id.is_some();
    let selected_turn = if use_current_turn {
        current_turn
    } else {
        latest_turn
    };

    let turn_started_at_ms = if selected_turn.started_at_ms > 0 {
        selected_turn.started_at_ms
    } else {
        last_seen_at_ms
    };

    Some(TranscriptSessionBackfill {
        session_id: session_id?,
        cwd: cwd?,
        model,
        transcript_path: transcript_path.to_string_lossy().to_string(),
        source,
        last_seen_at_ms,
        status: if selected_turn.completed {
            "idle".to_string()
        } else {
            "active".to_string()
        },
        turn_id: selected_turn.turn_id,
        prompt: selected_turn.prompt,
        turn_started_at_ms,
        recovered_events: selected_turn.events,
    })
}

pub fn recover_prompt_from_transcript(
    turn_id: Option<&str>,
    transcript_path: Option<&str>,
) -> Option<String> {
    let turn_id = turn_id?.trim();
    let transcript_path = transcript_path?.trim();
    if turn_id.is_empty() || transcript_path.is_empty() {
        return None;
    }

    let file = std::fs::File::open(transcript_path).ok()?;
    let reader = BufReader::new(file);
    let mut matched_turn = false;
    let mut latest_user_prompt = None;

    for line in reader.lines() {
        let line = line.ok()?;
        let entry: Value = serde_json::from_str(&line).ok()?;
        let entry_type = entry.get("type").and_then(Value::as_str);

        if entry_type == Some("event_msg") {
            match entry.pointer("/payload/type").and_then(Value::as_str) {
                Some("task_started") => {
                    matched_turn =
                        entry.pointer("/payload/turn_id").and_then(Value::as_str) == Some(turn_id);
                    continue;
                }
                Some("user_message") if matched_turn => {
                    if let Some(message) = entry.pointer("/payload/message").and_then(Value::as_str)
                    {
                        let message = message.trim();
                        if !message.is_empty() {
                            latest_user_prompt = Some(message.to_string());
                        }
                    }
                }
                Some("task_complete") if matched_turn => break,
                _ => {}
            }
        }

        if matched_turn
            && entry_type == Some("response_item")
            && entry.pointer("/payload/type").and_then(Value::as_str) == Some("message")
            && entry.pointer("/payload/role").and_then(Value::as_str) == Some("user")
        {
            if let Some(message) = extract_user_prompt_from_response_item(&entry) {
                latest_user_prompt = Some(message);
            }
        }
    }

    latest_user_prompt
}

pub fn recent_prompt_previews_from_transcript(transcript_path: &str, limit: usize) -> Vec<String> {
    if limit == 0 {
        return Vec::new();
    }

    let Ok(file) = std::fs::File::open(transcript_path) else {
        return Vec::new();
    };
    let reader = BufReader::new(file);
    let mut current_turn_id: Option<String> = None;
    let mut current_prompt: Option<String> = None;
    let mut prompts = Vec::new();

    for line in reader.lines() {
        let Ok(line) = line else {
            continue;
        };
        let Ok(entry) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        match entry.get("type").and_then(Value::as_str) {
            Some("event_msg") => match entry.pointer("/payload/type").and_then(Value::as_str) {
                Some("task_started") => {
                    if let Some(prompt) = current_prompt.take() {
                        let preview = summarize_prompt_preview(&prompt);
                        if !preview.is_empty() {
                            prompts.push(preview);
                        }
                    }
                    current_turn_id = entry
                        .pointer("/payload/turn_id")
                        .and_then(Value::as_str)
                        .map(|value| value.to_string());
                }
                Some("user_message") if current_turn_id.is_some() => {
                    current_prompt = entry
                        .pointer("/payload/message")
                        .and_then(Value::as_str)
                        .map(|value| value.to_string());
                }
                Some("task_complete")
                    if entry.pointer("/payload/turn_id").and_then(Value::as_str)
                        == current_turn_id.as_deref() =>
                {
                    if let Some(prompt) = current_prompt.take() {
                        let preview = summarize_prompt_preview(&prompt);
                        if !preview.is_empty() {
                            prompts.push(preview);
                        }
                    }
                    current_turn_id = None;
                }
                _ => {}
            },
            Some("response_item")
                if entry.pointer("/payload/type").and_then(Value::as_str) == Some("message")
                    && entry.pointer("/payload/role").and_then(Value::as_str) == Some("user")
                    && current_turn_id.is_some() =>
            {
                if let Some(message) = extract_user_prompt_from_response_item(&entry) {
                    current_prompt = Some(message);
                }
            }
            _ => {}
        }
    }

    if let Some(prompt) = current_prompt.take() {
        let preview = summarize_prompt_preview(&prompt);
        if !preview.is_empty() {
            prompts.push(preview);
        }
    }

    let mut deduped = Vec::new();
    let mut seen = BTreeSet::new();
    for prompt in prompts.into_iter().rev() {
        let normalized = prompt.split_whitespace().collect::<Vec<_>>().join(" ");
        if normalized.is_empty() || !seen.insert(normalized) {
            continue;
        }
        deduped.push(prompt);
        if deduped.len() >= limit {
            break;
        }
    }
    deduped
}

fn extract_user_prompt_from_response_item(entry: &Value) -> Option<String> {
    let items = entry.pointer("/payload/content")?.as_array()?;
    let mut parts = Vec::new();
    for item in items {
        if item.get("type").and_then(Value::as_str) != Some("input_text") {
            continue;
        }
        let Some(text) = item.get("text").and_then(Value::as_str) else {
            continue;
        };
        let text = text.trim();
        if !text.is_empty() {
            parts.push(text.to_string());
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

fn parse_rfc3339_ms(timestamp: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(timestamp)
        .ok()
        .map(|parsed| parsed.timestamp_millis())
        .or_else(|| {
            DateTime::parse_from_rfc3339(&format!("{timestamp}Z"))
                .ok()
                .map(|parsed| parsed.timestamp_millis())
        })
}

fn summarize_prompt_preview(prompt: &str) -> String {
    let normalized = prompt.split_whitespace().collect::<Vec<_>>().join(" ");
    truncate_text(&normalized, 180)
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    let mut out = String::new();
    for (index, ch) in text.chars().enumerate() {
        if index >= max_chars {
            out.push_str("...");
            break;
        }
        out.push(ch);
    }
    out
}

impl Default for TranscriptTurnBackfill {
    fn default() -> Self {
        Self {
            turn_id: None,
            prompt: None,
            completed: false,
            started_at_ms: 0,
            events: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn discover_transcript_session_roots_prefers_override_for_claude_config_dir() {
        let dir = tempdir().expect("tempdir");
        let home = dir.path().join("home");
        let custom_claude_root = dir.path().join("custom-claude").join("config");
        let codex_root = home.join(".codex").join("sessions");
        let default_claude_root = home.join(".claude").join("projects");
        let override_claude_root = custom_claude_root.join("projects");

        std::fs::create_dir_all(&codex_root).expect("create codex root");
        std::fs::create_dir_all(&default_claude_root).expect("create default claude projects root");
        std::fs::create_dir_all(&override_claude_root)
            .expect("create override claude projects root");

        let roots = crate::discover_transcript_session_roots_with_overrides(
            Some(&home),
            Some(&custom_claude_root),
        );

        assert!(roots.iter().any(|root| {
            root.kind == TranscriptSessionSource::Codex && root.path == codex_root
        }));
        assert!(roots.iter().any(|root| {
            root.kind == TranscriptSessionSource::ClaudeProjects
                && root.path == override_claude_root
        }));
        assert!(!roots.iter().any(|root| {
            root.kind == TranscriptSessionSource::ClaudeProjects && root.path == default_claude_root
        }));
    }

    #[test]
    fn recover_prompt_from_transcript_uses_matching_turn_user_message() {
        let dir = tempdir().expect("tempdir");
        let transcript = dir.path().join("session.jsonl");
        std::fs::write(
            &transcript,
            concat!(
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_started\",\"turn_id\":\"turn-2\"}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"second task\"}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_complete\",\"turn_id\":\"turn-2\"}}\n"
            ),
        )
        .expect("write transcript");
        let prompt = recover_prompt_from_transcript(Some("turn-2"), transcript.to_str());
        assert_eq!(prompt.as_deref(), Some("second task"));
    }

    #[test]
    fn recover_prompt_from_transcript_falls_back_to_response_item_user_text() {
        let dir = tempdir().expect("tempdir");
        let transcript = dir.path().join("session.jsonl");
        std::fs::write(
            &transcript,
            concat!(
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_started\",\"turn_id\":\"turn-3\"}}\n",
                "{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"recover from response item\"}]}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_complete\",\"turn_id\":\"turn-3\"}}\n"
            ),
        )
        .expect("write transcript");
        let prompt = recover_prompt_from_transcript(Some("turn-3"), transcript.to_str());
        assert_eq!(prompt.as_deref(), Some("recover from response item"));
    }

    #[test]
    fn recent_prompt_previews_from_transcript_returns_latest_first() {
        let dir = tempdir().expect("tempdir");
        let transcript = dir.path().join("session.jsonl");
        std::fs::write(
            &transcript,
            concat!(
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_started\",\"turn_id\":\"turn-1\"}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"first task\"}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_complete\",\"turn_id\":\"turn-1\"}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_started\",\"turn_id\":\"turn-2\"}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"second task\"}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_complete\",\"turn_id\":\"turn-2\"}}\n",
                "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_started\",\"turn_id\":\"turn-3\"}}\n",
                "{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"third task\"}]}}\n"
            ),
        )
        .expect("write transcript");

        let prompts = recent_prompt_previews_from_transcript(transcript.to_str().expect("path"), 3);
        assert_eq!(
            prompts,
            vec![
                "third task".to_string(),
                "second task".to_string(),
                "first task".to_string()
            ]
        );
    }
}
