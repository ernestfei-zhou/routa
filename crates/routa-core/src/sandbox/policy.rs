use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const SANDBOX_SCOPE_CONTAINER_ROOT: &str = "/workspace";
const SANDBOX_EXTRA_READONLY_ROOT: &str = "/workspace-extra/ro";
const SANDBOX_EXTRA_READWRITE_ROOT: &str = "/workspace-extra/rw";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum SandboxNetworkMode {
    #[default]
    Bridge,
    None,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum SandboxEnvMode {
    #[default]
    Sanitized,
    Inherit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SandboxMountAccess {
    ReadOnly,
    ReadWrite,
}

impl SandboxMountAccess {
    pub fn docker_suffix(self) -> &'static str {
        match self {
            Self::ReadOnly => "ro",
            Self::ReadWrite => "rw",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SandboxMount {
    pub host_path: String,
    pub container_path: String,
    pub access: SandboxMountAccess,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SandboxPolicyInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codebase_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workdir: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub read_only_paths: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub read_write_paths: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_mode: Option<SandboxNetworkMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env_mode: Option<SandboxEnvMode>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub env_allowlist: Vec<String>,
}

impl SandboxPolicyInput {
    pub fn is_empty(&self) -> bool {
        self.workspace_id.is_none()
            && self.codebase_id.is_none()
            && self.workdir.is_none()
            && self.read_only_paths.is_empty()
            && self.read_write_paths.is_empty()
            && self.network_mode.is_none()
            && self.env_mode.is_none()
            && self.env_allowlist.is_empty()
    }

    pub fn resolve(
        &self,
        context: Option<SandboxPolicyContext>,
    ) -> Result<ResolvedSandboxPolicy, String> {
        let derived_root = context
            .as_ref()
            .and_then(|ctx| ctx.workspace_root.as_ref())
            .map(|root| canonicalize_existing_path(root))
            .transpose()?;

        let host_workdir = match self.workdir.as_deref() {
            Some(raw) => resolve_user_path(raw, derived_root.as_deref())?,
            None => derived_root.clone().ok_or_else(|| {
                "Sandbox policy requires either policy.workdir or a workspace/codebase root."
                    .to_string()
            })?,
        };

        let scope_root = derived_root.clone().unwrap_or_else(|| host_workdir.clone());
        if !is_within(&scope_root, &host_workdir) {
            return Err(format!(
                "Resolved workdir '{}' escapes scope root '{}'.",
                host_workdir.display(),
                scope_root.display()
            ));
        }

        let mut notes = Vec::new();
        if derived_root.is_some() {
            notes.push(format!(
                "Resolved scope root from workspace/codebase context: {}",
                scope_root.display()
            ));
        } else {
            notes.push(format!(
                "No workspace/codebase root provided; using workdir as scope root: {}",
                scope_root.display()
            ));
        }

        let mut read_only_paths = resolve_grant_paths(&self.read_only_paths, &scope_root)?;
        let read_write_paths = resolve_grant_paths(&self.read_write_paths, &scope_root)?;

        let read_write_set: BTreeSet<PathBuf> = read_write_paths.iter().cloned().collect();
        read_only_paths.retain(|path| !read_write_set.contains(path));
        if self.read_only_paths.len() != read_only_paths.len() {
            notes.push(
                "Dropped duplicate read-only grants that were also present in read-write grants."
                    .to_string(),
            );
        }

        let scope_access = if read_write_set.contains(&scope_root) {
            SandboxMountAccess::ReadWrite
        } else {
            SandboxMountAccess::ReadOnly
        };

        let container_workdir = to_container_path(&scope_root, &host_workdir);
        let mut mounts = vec![SandboxMount {
            host_path: scope_root.to_string_lossy().to_string(),
            container_path: SANDBOX_SCOPE_CONTAINER_ROOT.to_string(),
            access: scope_access,
            reason: Some("scopeRoot".to_string()),
        }];

        let overrides = collect_override_mounts(
            &scope_root,
            scope_access,
            &read_only_paths,
            &read_write_paths,
            &mut notes,
        );
        mounts.extend(overrides);
        mounts.extend(collect_external_mounts(
            &scope_root,
            &read_only_paths,
            SandboxMountAccess::ReadOnly,
        ));
        mounts.extend(collect_external_mounts(
            &scope_root,
            &read_write_paths,
            SandboxMountAccess::ReadWrite,
        ));

        let env_allowlist = self
            .env_allowlist
            .iter()
            .map(|name| name.trim())
            .filter(|name| !name.is_empty())
            .map(ToOwned::to_owned)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();

        Ok(ResolvedSandboxPolicy {
            workspace_id: context.as_ref().and_then(|ctx| ctx.workspace_id.clone()),
            codebase_id: context.as_ref().and_then(|ctx| ctx.codebase_id.clone()),
            scope_root: scope_root.to_string_lossy().to_string(),
            host_workdir: host_workdir.to_string_lossy().to_string(),
            container_workdir,
            read_only_paths: read_only_paths
                .into_iter()
                .map(|path| path.to_string_lossy().to_string())
                .collect(),
            read_write_paths: read_write_paths
                .into_iter()
                .map(|path| path.to_string_lossy().to_string())
                .collect(),
            network_mode: self.network_mode.unwrap_or_default(),
            env_mode: self.env_mode.unwrap_or_default(),
            env_allowlist,
            mounts,
            notes,
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct SandboxPolicyContext {
    pub workspace_id: Option<String>,
    pub codebase_id: Option<String>,
    pub workspace_root: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSandboxPolicy {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codebase_id: Option<String>,
    pub scope_root: String,
    pub host_workdir: String,
    pub container_workdir: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub read_only_paths: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub read_write_paths: Vec<String>,
    pub network_mode: SandboxNetworkMode,
    pub env_mode: SandboxEnvMode,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub env_allowlist: Vec<String>,
    pub mounts: Vec<SandboxMount>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<String>,
}

fn resolve_grant_paths(raw_paths: &[String], scope_root: &Path) -> Result<Vec<PathBuf>, String> {
    raw_paths
        .iter()
        .map(|raw| resolve_user_path(raw, Some(scope_root)))
        .collect::<Result<BTreeSet<_>, _>>()
        .map(|set| set.into_iter().collect())
}

fn resolve_user_path(raw_path: &str, base_dir: Option<&Path>) -> Result<PathBuf, String> {
    let raw_path = raw_path.trim();
    if raw_path.is_empty() {
        return Err("Sandbox policy path entries cannot be empty.".to_string());
    }

    let candidate = PathBuf::from(raw_path);
    if candidate.is_absolute() {
        canonicalize_existing_path(&candidate)
    } else if let Some(base_dir) = base_dir {
        canonicalize_existing_path(&base_dir.join(candidate))
    } else {
        Err(format!(
            "Relative sandbox path '{}' requires a workspace/codebase root or explicit workdir base.",
            raw_path
        ))
    }
}

fn canonicalize_existing_path(path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(path)
        .map_err(|e| format!("Failed to resolve sandbox path '{}': {}", path.display(), e))
}

fn is_within(root: &Path, path: &Path) -> bool {
    path == root || path.starts_with(root)
}

fn to_container_path(scope_root: &Path, host_path: &Path) -> String {
    if host_path == scope_root {
        return SANDBOX_SCOPE_CONTAINER_ROOT.to_string();
    }

    let suffix = host_path
        .strip_prefix(scope_root)
        .unwrap_or(host_path)
        .components()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join("/");

    format!("{}/{}", SANDBOX_SCOPE_CONTAINER_ROOT, suffix)
}

fn collect_override_mounts(
    scope_root: &Path,
    scope_access: SandboxMountAccess,
    read_only_paths: &[PathBuf],
    read_write_paths: &[PathBuf],
    notes: &mut Vec<String>,
) -> Vec<SandboxMount> {
    let mut mounts = Vec::new();

    let mut push_override_mounts =
        |paths: &[PathBuf], access: SandboxMountAccess, redundant_when: SandboxMountAccess| {
            let mut paths = paths
                .iter()
                .filter(|path| is_within(scope_root, path) && *path != scope_root)
                .cloned()
                .collect::<Vec<_>>();

            paths.sort_by_key(|path| path.components().count());
            for path in paths {
                if scope_access == redundant_when {
                    notes.push(format!(
                        "Skipped redundant {:?} override inside scope root: {}",
                        access,
                        path.display()
                    ));
                    continue;
                }

                mounts.push(SandboxMount {
                    host_path: path.to_string_lossy().to_string(),
                    container_path: to_container_path(scope_root, &path),
                    access,
                    reason: Some("scopeOverride".to_string()),
                });
            }
        };

    push_override_mounts(
        read_only_paths,
        SandboxMountAccess::ReadOnly,
        SandboxMountAccess::ReadOnly,
    );
    push_override_mounts(
        read_write_paths,
        SandboxMountAccess::ReadWrite,
        SandboxMountAccess::ReadWrite,
    );

    mounts
}

fn collect_external_mounts(
    scope_root: &Path,
    paths: &[PathBuf],
    access: SandboxMountAccess,
) -> Vec<SandboxMount> {
    paths
        .iter()
        .filter(|path| !is_within(scope_root, path))
        .enumerate()
        .map(|(index, path)| SandboxMount {
            host_path: path.to_string_lossy().to_string(),
            container_path: format!(
                "{}/{:02}-{}",
                match access {
                    SandboxMountAccess::ReadOnly => SANDBOX_EXTRA_READONLY_ROOT,
                    SandboxMountAccess::ReadWrite => SANDBOX_EXTRA_READWRITE_ROOT,
                },
                index,
                sanitize_mount_name(path)
            ),
            access,
            reason: Some("explicitGrant".to_string()),
        })
        .collect()
}

fn sanitize_mount_name(path: &Path) -> String {
    let raw = path
        .file_name()
        .unwrap_or(path.as_os_str())
        .to_string_lossy();
    let name = raw
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(48)
        .collect::<String>();

    if name.is_empty() {
        "path".to_string()
    } else {
        name
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_dir(path: &Path) {
        std::fs::create_dir_all(path).expect("directory should be created");
    }

    fn canonical(path: &Path) -> String {
        std::fs::canonicalize(path)
            .expect("path should be canonicalizable")
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn empty_policy_is_detected() {
        assert!(SandboxPolicyInput::default().is_empty());
    }

    #[test]
    fn resolve_policy_uses_explicit_workdir_as_scope_when_no_context() {
        let temp = tempfile::tempdir().expect("tempdir should exist");
        let repo = temp.path().join("repo");
        let child = repo.join("src");
        write_dir(&child);

        let policy = SandboxPolicyInput {
            workdir: Some(repo.to_string_lossy().to_string()),
            read_write_paths: vec![child.to_string_lossy().to_string()],
            ..Default::default()
        };

        let resolved = policy.resolve(None).expect("policy should resolve");
        assert_eq!(resolved.scope_root, canonical(&repo));
        assert_eq!(resolved.container_workdir, SANDBOX_SCOPE_CONTAINER_ROOT);
        assert_eq!(resolved.mounts[0].access, SandboxMountAccess::ReadOnly);
        assert!(resolved.mounts.iter().any(|mount| {
            mount.container_path.ends_with("/src") && mount.access == SandboxMountAccess::ReadWrite
        }));
    }

    #[test]
    fn resolve_policy_uses_workspace_root_for_relative_paths() {
        let temp = tempfile::tempdir().expect("tempdir should exist");
        let repo = temp.path().join("repo");
        let scripts = repo.join("scripts");
        write_dir(&scripts);

        let policy = SandboxPolicyInput {
            workdir: Some("scripts".to_string()),
            read_write_paths: vec!["scripts".to_string()],
            ..Default::default()
        };
        let context = SandboxPolicyContext {
            workspace_id: Some("ws-1".to_string()),
            codebase_id: Some("cb-1".to_string()),
            workspace_root: Some(repo.clone()),
        };

        let resolved = policy
            .resolve(Some(context))
            .expect("policy should resolve");
        assert_eq!(resolved.host_workdir, canonical(&scripts));
        assert_eq!(resolved.container_workdir, "/workspace/scripts");
    }

    #[test]
    fn resolve_policy_rejects_workdir_outside_scope_root() {
        let temp = tempfile::tempdir().expect("tempdir should exist");
        let repo = temp.path().join("repo");
        let outside = temp.path().join("outside");
        write_dir(&repo);
        write_dir(&outside);

        let policy = SandboxPolicyInput {
            workdir: Some(outside.to_string_lossy().to_string()),
            ..Default::default()
        };
        let context = SandboxPolicyContext {
            workspace_root: Some(repo),
            ..Default::default()
        };

        let err = policy
            .resolve(Some(context))
            .expect_err("workdir outside root should fail");
        assert!(err.contains("escapes scope root"));
    }

    #[test]
    fn read_write_grant_wins_over_read_only_duplicate() {
        let temp = tempfile::tempdir().expect("tempdir should exist");
        let repo = temp.path().join("repo");
        let cache = repo.join("cache");
        write_dir(&cache);

        let policy = SandboxPolicyInput {
            workdir: Some(repo.to_string_lossy().to_string()),
            read_only_paths: vec![cache.to_string_lossy().to_string()],
            read_write_paths: vec![cache.to_string_lossy().to_string()],
            ..Default::default()
        };

        let resolved = policy.resolve(None).expect("policy should resolve");
        assert!(resolved.read_only_paths.is_empty());
        assert_eq!(resolved.read_write_paths, vec![canonical(&cache)]);
    }
}
