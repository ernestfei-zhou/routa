use crate::models::DetectedAgent;
use anyhow::{Context, Result};
use std::collections::BTreeMap;
use std::process::Command;

const MAX_AGENTS: usize = 8;

pub fn scan_agents(repo_root: &str) -> Result<Vec<DetectedAgent>> {
    let output = Command::new("ps")
        .args(["-axo", "pid=,ppid=,command="])
        .output()
        .context("run ps for agent detection")?;
    if !output.status.success() {
        anyhow::bail!("ps agent scan failed");
    }

    let stdout = String::from_utf8(output.stdout).context("decode ps output")?;
    let mut by_key = BTreeMap::new();

    for line in stdout.lines() {
        let Some(agent) = parse_agent_line(line, repo_root) else {
            continue;
        };
        by_key.entry(agent.key.clone()).or_insert(agent);
    }

    Ok(by_key.into_values().take(MAX_AGENTS).collect())
}

fn parse_agent_line(line: &str, repo_root: &str) -> Option<DetectedAgent> {
    let mut parts = line.trim().splitn(3, char::is_whitespace);
    let pid = parts.next()?.trim().parse::<u32>().ok()?;
    let _ppid = parts.next()?;
    let command = parts.next()?.trim().to_string();
    let vendor = classify_vendor(&command)?;

    let cwd = detect_cwd(pid);
    let relevant = command.contains(repo_root)
        || cwd
            .as_deref()
            .is_some_and(|path| path == repo_root || path.starts_with(&format!("{repo_root}/")));
    if !relevant {
        return None;
    }

    Some(DetectedAgent {
        key: format!("{vendor}:{pid}"),
        vendor: vendor.to_string(),
        pid,
        cwd,
        command,
    })
}

fn classify_vendor(command: &str) -> Option<&'static str> {
    let lower = command.to_ascii_lowercase();
    if lower.contains("codex") {
        Some("codex")
    } else if lower.contains("claude") {
        Some("claude")
    } else if lower.contains("cursor") {
        Some("cursor")
    } else if lower.contains("copilot") {
        Some("copilot")
    } else if lower.contains("gemini") {
        Some("gemini")
    } else if lower.contains("aider") {
        Some("aider")
    } else {
        None
    }
}

fn detect_cwd(pid: u32) -> Option<String> {
    let output = Command::new("lsof")
        .args(["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8(output.stdout).ok()?;
    stdout
        .lines()
        .find_map(|line| line.strip_prefix('n').map(|value| value.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_known_agent_vendor() {
        assert_eq!(
            parse_agent_line(
                "123 1 /usr/local/bin/codex --cwd /Users/phodal/ai/routa-js",
                "/Users/phodal/ai/routa-js"
            )
            .map(|agent| agent.vendor),
            Some("codex".to_string())
        );
    }

    #[test]
    fn ignore_non_agent_processes() {
        assert!(parse_agent_line("222 1 /usr/bin/vim foo.rs", "/tmp/project").is_none());
    }
}
