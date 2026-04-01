use axum::{
    extract::State,
    routing::{get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::api::repo_context::{normalize_local_repo_path, validate_local_git_repo_path};
use crate::error::ServerError;
use crate::models::codebase::Codebase;
use crate::state::AppState;

fn repo_label_from_path(repo_path: &str) -> String {
    std::path::Path::new(repo_path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| repo_path.to_string())
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/workspaces/{workspace_id}/codebases",
            get(list_codebases).post(add_codebase),
        )
        .route(
            "/workspaces/{workspace_id}/codebases/changes",
            get(list_codebase_changes),
        )
        .route(
            "/workspaces/{workspace_id}/codebases/{codebase_id}/reposlide",
            get(get_reposlide),
        )
        .route(
            "/codebases/{id}",
            patch(update_codebase).delete(delete_codebase),
        )
        .route("/codebases/{id}/default", post(set_default_codebase))
}

async fn list_codebases(
    State(state): State<AppState>,
    axum::extract::Path(workspace_id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let codebases = state
        .codebase_store
        .list_by_workspace(&workspace_id)
        .await?;
    Ok(Json(serde_json::json!({ "codebases": codebases })))
}

async fn list_codebase_changes(
    State(state): State<AppState>,
    axum::extract::Path(workspace_id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let codebases = state
        .codebase_store
        .list_by_workspace(&workspace_id)
        .await?;

    let repos = codebases
        .into_iter()
        .map(|codebase| {
            let label = codebase
                .label
                .clone()
                .unwrap_or_else(|| repo_label_from_path(&codebase.repo_path));

            if codebase.repo_path.is_empty() {
                return serde_json::json!({
                    "codebaseId": codebase.id,
                    "repoPath": codebase.repo_path,
                    "label": label,
                    "branch": codebase.branch.unwrap_or_else(|| "unknown".to_string()),
                    "status": { "clean": true, "ahead": 0, "behind": 0, "modified": 0, "untracked": 0 },
                    "files": [],
                    "error": "Missing repository path",
                });
            }

            if !crate::git::is_git_repository(&codebase.repo_path) {
                return serde_json::json!({
                    "codebaseId": codebase.id,
                    "repoPath": codebase.repo_path,
                    "label": label,
                    "branch": codebase.branch.unwrap_or_else(|| "unknown".to_string()),
                    "status": { "clean": true, "ahead": 0, "behind": 0, "modified": 0, "untracked": 0 },
                    "files": [],
                    "error": "Repository is missing or not a git repository",
                });
            }

            let changes = crate::git::get_repo_changes(&codebase.repo_path);
            serde_json::json!({
                "codebaseId": codebase.id,
                "repoPath": codebase.repo_path,
                "label": label,
                "branch": changes.branch,
                "status": changes.status,
                "files": changes.files,
            })
        })
        .collect::<Vec<_>>();

    Ok(Json(serde_json::json!({
        "workspaceId": workspace_id,
        "repos": repos,
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddCodebaseRequest {
    repo_path: String,
    branch: Option<String>,
    label: Option<String>,
    #[serde(default)]
    is_default: bool,
}

async fn add_codebase(
    State(state): State<AppState>,
    axum::extract::Path(workspace_id): axum::extract::Path<String>,
    Json(body): Json<AddCodebaseRequest>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let repo_path = normalize_local_repo_path(&body.repo_path);
    validate_local_git_repo_path(&repo_path)?;
    let repo_path = repo_path.to_string_lossy().to_string();

    // Check for duplicate repo_path within the workspace
    if let Some(_existing) = state
        .codebase_store
        .find_by_repo_path(&workspace_id, &repo_path)
        .await?
    {
        return Err(ServerError::Conflict(format!(
            "Codebase with repo_path '{}' already exists in workspace {}",
            repo_path, workspace_id
        )));
    }

    let codebase = Codebase::new(
        uuid::Uuid::new_v4().to_string(),
        workspace_id,
        repo_path,
        body.branch,
        body.label,
        body.is_default,
    );

    state.codebase_store.save(&codebase).await?;
    Ok(Json(serde_json::json!({ "codebase": codebase })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCodebaseRequest {
    branch: Option<String>,
    label: Option<String>,
    repo_path: Option<String>,
}

async fn update_codebase(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<UpdateCodebaseRequest>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let existing = state
        .codebase_store
        .get(&id)
        .await?
        .ok_or_else(|| ServerError::NotFound(format!("Codebase {} not found", id)))?;

    let repo_path = if let Some(repo_path) = body.repo_path.as_deref() {
        let normalized = normalize_local_repo_path(repo_path);
        validate_local_git_repo_path(&normalized)?;
        let normalized = normalized.to_string_lossy().to_string();

        if let Some(duplicate) = state
            .codebase_store
            .find_by_repo_path(&existing.workspace_id, &normalized)
            .await?
        {
            if duplicate.id != id {
                return Err(ServerError::Conflict(format!(
                    "Codebase with repo_path '{}' already exists in workspace {}",
                    normalized, existing.workspace_id
                )));
            }
        }

        Some(normalized)
    } else {
        None
    };

    state
        .codebase_store
        .update(
            &id,
            body.branch.as_deref(),
            body.label.as_deref(),
            repo_path.as_deref(),
        )
        .await?;

    let codebase = state
        .codebase_store
        .get(&id)
        .await?
        .ok_or_else(|| ServerError::NotFound(format!("Codebase {} not found", id)))?;

    Ok(Json(serde_json::json!({ "codebase": codebase })))
}

async fn delete_codebase(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, ServerError> {
    // Clean up worktrees on disk before deleting the codebase
    if let Ok(Some(codebase)) = state.codebase_store.get(&id).await {
        let repo_path = &codebase.repo_path;

        // Acquire repo lock to prevent races with concurrent worktree operations
        let lock = {
            let mut locks = crate::api::worktrees::get_repo_locks().lock().await;
            locks
                .entry(repo_path.to_string())
                .or_insert_with(|| std::sync::Arc::new(tokio::sync::Mutex::new(())))
                .clone()
        };
        let _guard = lock.lock().await;

        let worktrees = state
            .worktree_store
            .list_by_codebase(&id)
            .await
            .map_err(|e| ServerError::Internal(format!("Failed to list worktrees: {}", e)))?;
        for wt in &worktrees {
            if let Err(e) = crate::git::worktree_remove(repo_path, &wt.worktree_path, true) {
                tracing::warn!(
                    "[Codebase DELETE] Failed to remove worktree {}: {}",
                    wt.id,
                    e
                );
            }
        }
        if !worktrees.is_empty() {
            let _ = crate::git::worktree_prune(repo_path);
        }
    }

    state.codebase_store.delete(&id).await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn set_default_codebase(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let codebase = state
        .codebase_store
        .get(&id)
        .await?
        .ok_or_else(|| ServerError::NotFound(format!("Codebase {} not found", id)))?;

    state
        .codebase_store
        .set_default(&codebase.workspace_id, &id)
        .await?;

    let updated = state
        .codebase_store
        .get(&id)
        .await?
        .ok_or_else(|| ServerError::NotFound(format!("Codebase {} not found", id)))?;

    Ok(Json(serde_json::json!({ "codebase": updated })))
}

// ─── RepoSlide ──────────────────────────────────────────────────

const IGNORE_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "target",
    ".routa",
    ".worktrees",
    "__pycache__",
    ".tox",
    ".venv",
    "venv",
    ".cache",
];

const MAX_DEPTH: usize = 4;
const MAX_CHILDREN: usize = 50;
const MAX_DIR_FOCUS_SLIDES: usize = 6;

const ENTRY_POINT_FILES: &[&str] = &[
    "README.md",
    "AGENTS.md",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "setup.py",
    "pom.xml",
    "build.gradle",
    "Makefile",
    "Dockerfile",
    "docker-compose.yml",
    "tsconfig.json",
];

const ANCHOR_DIRS: &[&str] = &[
    "src/app",
    "src/core",
    "src/client",
    "crates",
    "apps",
    "lib",
    "pkg",
    "cmd",
    "internal",
    "api",
];

const KEY_FILE_NAMES: &[&str] = &[
    "README.md",
    "AGENTS.md",
    "ARCHITECTURE.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "CHANGELOG.md",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoTreeNode {
    name: String,
    path: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<RepoTreeNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_count: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoSummary {
    total_files: u64,
    total_directories: u64,
    top_level_folders: Vec<String>,
    source_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoSlide {
    id: String,
    #[serde(rename = "type")]
    slide_type: String,
    title: String,
    content: serde_json::Value,
}

fn scan_repo_tree(repo_path: &str) -> RepoTreeNode {
    let root_name = std::path::Path::new(repo_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(repo_path)
        .to_string();
    scan_dir(repo_path, &root_name, ".", 0)
}

fn scan_dir(abs_path: &str, name: &str, rel_path: &str, depth: usize) -> RepoTreeNode {
    let mut node = RepoTreeNode {
        name: name.to_string(),
        path: rel_path.to_string(),
        node_type: "directory".to_string(),
        children: Some(Vec::new()),
        file_count: Some(0),
    };

    if depth >= MAX_DEPTH {
        return node;
    }

    let mut entries: Vec<std::fs::DirEntry> = match std::fs::read_dir(abs_path) {
        Ok(rd) => rd.filter_map(|e| e.ok()).collect(),
        Err(_) => return node,
    };

    entries.sort_by(|a, b| {
        let a_dir = a.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        let b_dir = b.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        match (a_dir, b_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    let children = node.children.as_mut().unwrap();
    let mut file_count: u64 = 0;
    let mut child_count = 0;

    for entry in entries {
        if child_count >= MAX_CHILDREN {
            break;
        }
        let entry_name = entry.file_name().to_string_lossy().to_string();
        if IGNORE_DIRS.contains(&entry_name.as_str()) {
            continue;
        }
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        let child_rel = if rel_path == "." {
            entry_name.clone()
        } else {
            format!("{}/{}", rel_path, entry_name)
        };
        let child_abs = format!("{}/{}", abs_path, entry_name);

        if ft.is_dir() {
            let child = scan_dir(&child_abs, &entry_name, &child_rel, depth + 1);
            file_count += child.file_count.unwrap_or(0);
            children.push(child);
        } else if ft.is_file() {
            children.push(RepoTreeNode {
                name: entry_name,
                path: child_rel,
                node_type: "file".to_string(),
                children: None,
                file_count: None,
            });
            file_count += 1;
        }

        child_count += 1;
    }

    node.file_count = Some(file_count);
    node
}

fn compute_summary(tree: &RepoTreeNode, source_type: &str, branch: Option<&str>) -> RepoSummary {
    let (files, dirs) = count_tree(tree);
    let top_level_folders = tree
        .children
        .as_ref()
        .map(|c| {
            c.iter()
                .filter(|n| n.node_type == "directory")
                .map(|n| n.name.clone())
                .collect()
        })
        .unwrap_or_default();

    RepoSummary {
        total_files: files,
        total_directories: dirs,
        top_level_folders,
        source_type: source_type.to_string(),
        branch: branch.map(str::to_string),
    }
}

fn count_tree(node: &RepoTreeNode) -> (u64, u64) {
    if node.node_type == "file" {
        return (1, 0);
    }
    let mut files = 0u64;
    let mut dirs = 1u64;
    for child in node.children.as_deref().unwrap_or(&[]) {
        let (f, d) = count_tree(child);
        files += f;
        dirs += d;
    }
    (files, dirs)
}

fn build_slides(codebase: &Codebase, tree: &RepoTreeNode, summary: &RepoSummary) -> Vec<RepoSlide> {
    let mut slides = Vec::new();

    // 1. Overview
    let label = codebase
        .label
        .clone()
        .unwrap_or_else(|| repo_label_from_path(&codebase.repo_path));
    slides.push(RepoSlide {
        id: "overview".to_string(),
        slide_type: "overview".to_string(),
        title: "Repository Overview".to_string(),
        content: serde_json::json!({
            "label": label,
            "repoPath": codebase.repo_path,
            "branch": codebase.branch.as_deref().unwrap_or("unknown"),
            "sourceType": summary.source_type,
            "totalFiles": summary.total_files,
            "totalDirectories": summary.total_directories,
        }),
    });

    // 2. Top-level structure
    let dirs: Vec<serde_json::Value> = tree
        .children
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .filter(|c| c.node_type == "directory")
        .map(|c| {
            serde_json::json!({
                "name": c.name,
                "fileCount": c.file_count.unwrap_or(0),
            })
        })
        .collect();
    let root_files: Vec<String> = tree
        .children
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .filter(|c| c.node_type == "file")
        .map(|c| c.name.clone())
        .collect();
    slides.push(RepoSlide {
        id: "top-level-structure".to_string(),
        slide_type: "top-level-structure".to_string(),
        title: "Top-level Structure".to_string(),
        content: serde_json::json!({
            "directories": dirs,
            "rootFiles": root_files,
        }),
    });

    // 3. Entry points
    let entry_points = detect_entry_points(tree);
    if !entry_points.is_empty() {
        slides.push(RepoSlide {
            id: "entry-points".to_string(),
            slide_type: "entry-points".to_string(),
            title: "Entry Points & Architecture Anchors".to_string(),
            content: serde_json::json!({ "entryPoints": entry_points }),
        });
    }

    // 4. Directory focus
    let mut focus_dirs: Vec<&RepoTreeNode> = tree
        .children
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .filter(|c| c.node_type == "directory")
        .collect();
    focus_dirs.sort_by(|a, b| {
        b.file_count
            .unwrap_or(0)
            .cmp(&a.file_count.unwrap_or(0))
    });
    for dir in focus_dirs.into_iter().take(MAX_DIR_FOCUS_SLIDES) {
        let children_info: Vec<serde_json::Value> = dir
            .children
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .map(|c| {
                let mut v = serde_json::json!({
                    "name": c.name,
                    "type": c.node_type,
                });
                if c.node_type == "directory" {
                    v["fileCount"] = serde_json::json!(c.file_count.unwrap_or(0));
                }
                v
            })
            .collect();
        slides.push(RepoSlide {
            id: format!("dir-focus-{}", dir.name),
            slide_type: "directory-focus".to_string(),
            title: dir.name.clone(),
            content: serde_json::json!({
                "path": dir.path,
                "fileCount": dir.file_count.unwrap_or(0),
                "children": children_info,
            }),
        });
    }

    // 5. Key files
    let key_files: Vec<serde_json::Value> = tree
        .children
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .filter(|c| c.node_type == "file" && KEY_FILE_NAMES.contains(&c.name.as_str()))
        .map(|c| {
            serde_json::json!({
                "name": c.name,
                "path": c.path,
            })
        })
        .collect();
    if !key_files.is_empty() {
        slides.push(RepoSlide {
            id: "key-files".to_string(),
            slide_type: "key-files".to_string(),
            title: "Key Files".to_string(),
            content: serde_json::json!({ "files": key_files }),
        });
    }

    slides
}

fn detect_entry_points(tree: &RepoTreeNode) -> Vec<serde_json::Value> {
    let mut found = Vec::new();

    for child in tree.children.as_deref().unwrap_or(&[]) {
        if child.node_type == "file" && ENTRY_POINT_FILES.contains(&child.name.as_str()) {
            found.push(serde_json::json!({
                "name": child.name,
                "path": child.path,
                "reason": format!("Project entry point ({})", child.name),
            }));
        }
    }

    for anchor in ANCHOR_DIRS {
        if let Some(node) = find_node_by_path(tree, anchor) {
            found.push(serde_json::json!({
                "name": *anchor,
                "path": node.path,
                "reason": "Architecture anchor directory",
            }));
        }
    }

    found
}

fn find_node_by_path<'a>(tree: &'a RepoTreeNode, target: &str) -> Option<&'a RepoTreeNode> {
    let segments: Vec<&str> = target.split('/').collect();
    let mut current = tree;
    for seg in &segments {
        current = current
            .children
            .as_ref()?
            .iter()
            .find(|c| c.name == *seg)?;
    }
    Some(current)
}

async fn get_reposlide(
    State(state): State<AppState>,
    axum::extract::Path((workspace_id, codebase_id)): axum::extract::Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let codebase = state
        .codebase_store
        .get(&codebase_id)
        .await?
        .ok_or_else(|| ServerError::NotFound(format!("Codebase {} not found", codebase_id)))?;

    if codebase.workspace_id != workspace_id {
        return Err(ServerError::NotFound(format!(
            "Codebase {} not found in workspace {}",
            codebase_id, workspace_id
        )));
    }

    if codebase.repo_path.is_empty() {
        return Err(ServerError::BadRequest(
            "Codebase has no repository path".to_string(),
        ));
    }

    let tree = scan_repo_tree(&codebase.repo_path);
    let source_type = "local";
    let summary = compute_summary(&tree, source_type, codebase.branch.as_deref());
    let slides = build_slides(&codebase, &tree, &summary);

    Ok(Json(serde_json::json!({
        "codebase": {
            "id": codebase.id,
            "label": codebase.label,
            "repoPath": codebase.repo_path,
            "sourceType": source_type,
            "branch": codebase.branch,
        },
        "summary": summary,
        "tree": tree,
        "slides": slides,
    })))
}
