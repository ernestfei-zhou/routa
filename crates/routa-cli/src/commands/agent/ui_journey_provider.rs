use std::fs::OpenOptions;
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use routa_core::acp::{get_preset_by_id_with_registry, AcpPreset};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProviderRuntimeDiagnostic {
    pub(crate) failure_stage_override: Option<&'static str>,
    pub(crate) hint: Option<String>,
}

pub(crate) async fn verify_provider_readiness(provider: &str) -> Result<(), String> {
    let normalized_provider = provider.trim().to_lowercase();
    if normalized_provider.is_empty() {
        return Err("Provider is empty".to_string());
    }

    let preset = get_preset_by_id_with_registry(&normalized_provider)
        .await
        .map_err(|err| format!("Unsupported provider '{}': {}", normalized_provider, err))?;
    let command = resolve_preset_command(&preset);

    if !command_exists(&command) {
        return Err(format!(
            "Provider '{}' requires '{}' but command not found. Is it installed and in PATH?",
            normalized_provider, command
        ));
    }

    if normalized_provider == "opencode" {
        verify_opencode_config_directory()?;
        verify_opencode_data_directory()?;
    }

    if normalized_provider == "claude"
        && std::env::var("ANTHROPIC_AUTH_TOKEN").is_err()
        && std::env::var("ANTHROPIC_API_KEY").is_err()
    {
        println!(
            "⚠️  Claude may require authentication (no ANTHROPIC_AUTH_TOKEN/ANTHROPIC_API_KEY)."
        );
    }

    Ok(())
}

pub(crate) fn augment_runtime_failure_message(
    provider: &str,
    failure_message: &str,
    run_started_at: SystemTime,
    prompt_status: Option<&str>,
    history_entry_count: usize,
    output_chars: usize,
    last_process_output: Option<&str>,
) -> String {
    let Some(diagnostic) = diagnose_runtime_failure(
        provider,
        run_started_at,
        prompt_status,
        history_entry_count,
        output_chars,
        last_process_output,
    ) else {
        return failure_message.to_string();
    };

    let Some(hint) = diagnostic.hint else {
        return failure_message.to_string();
    };
    format!("{}; hint: {}", failure_message, hint)
}

pub(crate) fn diagnose_runtime_failure(
    provider: &str,
    run_started_at: SystemTime,
    prompt_status: Option<&str>,
    history_entry_count: usize,
    output_chars: usize,
    last_process_output: Option<&str>,
) -> Option<ProviderRuntimeDiagnostic> {
    let normalized_process_output = last_process_output
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let mut hints = Vec::new();
    if let Some(output) = normalized_process_output {
        hints.push(format!("last process output: {}", truncate(output, 240)));
    }

    let mut failure_stage_override = None;
    if provider.trim().eq_ignore_ascii_case("opencode")
        && output_chars == 0
        && history_entry_count <= 1
        && normalized_process_output.is_none()
        && matches!(prompt_status, Some("pending" | "rpc_timeout" | "error"))
    {
        if let Some(opencode_diagnostic) = latest_opencode_failure_hint(run_started_at) {
            if let Some(stage) = opencode_diagnostic.failure_stage_override {
                failure_stage_override = Some(stage);
            }
            if let Some(hint) = opencode_diagnostic.hint {
                hints.push(hint);
            }
        }
    }

    if hints.is_empty() && failure_stage_override.is_none() {
        return None;
    }

    Some(ProviderRuntimeDiagnostic {
        failure_stage_override,
        hint: (!hints.is_empty()).then(|| hints.join(" | ")),
    })
}

fn resolve_preset_command(preset: &AcpPreset) -> String {
    if let Some(env_var) = &preset.env_bin_override {
        if let Ok(custom_command) = std::env::var(env_var) {
            let trimmed = custom_command.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    preset.command.clone()
}

fn command_exists(command: &str) -> bool {
    if command.trim().is_empty() {
        return false;
    }

    if Path::new(command).is_file() || command.contains(std::path::MAIN_SEPARATOR) {
        Path::new(command).is_file()
    } else {
        routa_core::shell_env::which(command).is_some()
    }
}

fn verify_opencode_config_directory() -> Result<(), String> {
    let config_base = std::env::var("XDG_CONFIG_HOME")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".config")))
        .ok_or_else(|| "Failed to resolve config directory".to_string())?;
    let config_dir = config_base.join("opencode");
    verify_directory_writable(&config_dir, "config")
}

fn verify_opencode_data_directory() -> Result<(), String> {
    let data_base = std::env::var("XDG_DATA_HOME")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".local/share")))
        .ok_or_else(|| "Failed to resolve OpenCode data directory".to_string())?;
    let data_dir = data_base.join("opencode");
    verify_directory_writable(&data_dir, "data")?;

    let database_path = data_dir.join("opencode.db");
    if database_path.exists() {
        OpenOptions::new()
            .read(true)
            .write(true)
            .open(&database_path)
            .map_err(|err| {
                format!(
                    "OpenCode database is not writable at {}: {}",
                    database_path.display(),
                    err
                )
            })?;
    }

    Ok(())
}

fn verify_directory_writable(dir: &Path, label: &str) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|err| {
        format!(
            "Failed to ensure OpenCode {} dir {}: {}",
            label,
            dir.display(),
            err
        )
    })?;

    let check_file = dir.join(format!(".routa-acp-{}-check", uuid::Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&check_file)
        .map_err(|err| format!("Failed to write {}: {}", check_file.display(), err))?;
    file.write_all(b"routa cli provider health check")
        .map_err(|err| format!("Failed to write {}: {}", check_file.display(), err))?;
    std::fs::remove_file(&check_file)
        .map_err(|err| format!("Failed to clean {}: {}", check_file.display(), err))?;
    Ok(())
}

fn latest_opencode_failure_hint(run_started_at: SystemTime) -> Option<ProviderRuntimeDiagnostic> {
    let log_dir = resolve_opencode_log_dir()?;
    let threshold = run_started_at
        .checked_sub(Duration::from_secs(120))
        .unwrap_or(run_started_at);
    let mut candidates = std::fs::read_dir(&log_dir)
        .ok()?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let metadata = entry.metadata().ok()?;
            if !metadata.is_file() {
                return None;
            }
            let modified = metadata.modified().ok()?;
            if modified < threshold {
                return None;
            }
            Some((modified, path))
        })
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| right.0.cmp(&left.0));

    candidates
        .into_iter()
        .take(5)
        .find_map(|(_, path)| extract_opencode_failure_hint(&path))
}

fn resolve_opencode_log_dir() -> Option<PathBuf> {
    let data_base = std::env::var("XDG_DATA_HOME")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".local/share")))?;
    Some(data_base.join("opencode").join("log"))
}

fn extract_opencode_failure_hint(path: &Path) -> Option<ProviderRuntimeDiagnostic> {
    let contents = std::fs::read_to_string(path).ok()?;
    let file_name = path.file_name()?.to_string_lossy();

    if contents.contains("FreeUsageLimitError") || contents.contains("Rate limit exceeded") {
        return Some(ProviderRuntimeDiagnostic {
            failure_stage_override: Some("provider_rate_limited"),
            hint: Some(format!(
                "latest OpenCode log {} reports rate limiting from opencode.ai/zen (FreeUsageLimitError)",
                file_name
            )),
        });
    }

    if contents.contains("attempt to write a readonly database") {
        return Some(ProviderRuntimeDiagnostic {
            failure_stage_override: Some("provider_storage"),
            hint: Some(format!(
                "latest OpenCode log {} reports a readonly database in the OpenCode data directory",
                file_name
            )),
        });
    }

    if contents.contains("service=llm providerID=opencode") {
        return Some(ProviderRuntimeDiagnostic {
            failure_stage_override: Some("provider_runtime"),
            hint: Some(format!(
                "latest OpenCode log {} started an LLM stream but produced no assistant output before shutdown",
                file_name
            )),
        });
    }

    contents
        .lines()
        .rev()
        .find(|line| line.contains("service=session.processor error="))
        .map(|line| ProviderRuntimeDiagnostic {
            failure_stage_override: Some("provider_runtime"),
            hint: Some(format!(
                "latest OpenCode log {} reports {}",
                file_name,
                truncate(line, 240)
            )),
        })
}

fn truncate(value: &str, max_chars: usize) -> String {
    let truncated = value.chars().take(max_chars).collect::<String>();
    if value.chars().count() > max_chars {
        format!("{}...", truncated)
    } else {
        truncated
    }
}

#[cfg(test)]
mod tests {
    use super::{
        augment_runtime_failure_message, diagnose_runtime_failure, extract_opencode_failure_hint,
        truncate,
    };
    use std::fs;
    use std::time::SystemTime;
    use tempfile::tempdir;

    #[test]
    fn extracts_rate_limit_hint_from_opencode_log() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("2026-03-25T072419.log");
        fs::write(&path, "ERROR service=session.processor error=Rate limit exceeded. Please try again later.\nFreeUsageLimitError").unwrap();

        let diagnostic = extract_opencode_failure_hint(&path).unwrap();
        assert_eq!(
            diagnostic.failure_stage_override,
            Some("provider_rate_limited")
        );
        assert!(diagnostic.hint.unwrap().contains("2026-03-25T072419.log"));
    }

    #[test]
    fn extracts_readonly_database_hint_from_opencode_log() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("2026-03-25T065843.log");
        fs::write(
            &path,
            "Error: Unexpected error\nattempt to write a readonly database",
        )
        .unwrap();

        let diagnostic = extract_opencode_failure_hint(&path).unwrap();
        assert_eq!(diagnostic.failure_stage_override, Some("provider_storage"));
        assert!(diagnostic.hint.unwrap().contains("readonly database"));
    }

    #[test]
    fn augments_runtime_failure_with_process_output() {
        let message = augment_runtime_failure_message(
            "opencode",
            "UI journey exceeded the maximum runtime budget",
            SystemTime::now(),
            Some("pending"),
            1,
            0,
            Some("provider stderr line"),
        );

        assert!(message.contains("last process output"));
        assert!(message.contains("provider stderr line"));
    }

    #[test]
    fn extracts_runtime_stall_hint_from_opencode_log() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("2026-03-25T074517.log");
        fs::write(
            &path,
            "INFO service=session.processor process\nINFO service=llm providerID=opencode modelID=big-pickle stream",
        )
        .unwrap();

        let diagnostic = extract_opencode_failure_hint(&path).unwrap();
        assert_eq!(diagnostic.failure_stage_override, Some("provider_runtime"));
        assert!(diagnostic
            .hint
            .unwrap()
            .contains("produced no assistant output"));
    }

    #[test]
    fn diagnoses_runtime_failure_for_non_empty_process_output() {
        let diagnostic = diagnose_runtime_failure(
            "opencode",
            SystemTime::now(),
            Some("pending"),
            1,
            0,
            Some("provider stderr line"),
        )
        .unwrap();

        assert_eq!(diagnostic.failure_stage_override, None);
        assert!(diagnostic
            .hint
            .unwrap()
            .contains("last process output: provider stderr line"));
    }

    #[test]
    fn truncate_appends_ellipsis_for_long_strings() {
        assert_eq!(truncate("abcdef", 4), "abcd...");
        assert_eq!(truncate("abc", 4), "abc");
    }
}
