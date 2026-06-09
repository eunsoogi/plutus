use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::{
    path::PathBuf,
    process::{Command, Stdio},
};

use crate::storage::AppDataPaths;

mod runtime_stream;
pub(super) use runtime_stream::{next_run_event_sequence, spawn_codex_runtime_stream_consumer};

pub struct CodexRuntimeStart {
    pub run_id: String,
    pub profile_id: String,
    pub portfolio_id: Option<String>,
    pub selected_team: String,
    pub user_request: String,
    pub workspace_path: String,
}

#[derive(Debug, Clone)]
pub struct CodexRuntimeStarted {
    pub thread_id: String,
    pub runtime: String,
    pub command: Vec<String>,
    pub events: Vec<Value>,
    pub final_output: Option<Value>,
}

#[derive(Debug, Clone, Default)]
pub struct CodexRuntimeBridge;

impl CodexRuntimeBridge {
    pub fn start(&self, input: CodexRuntimeStart) -> Result<CodexRuntimeStarted> {
        let repo_root = plutus_repo_root()?;
        let command = codex_runtime_command(&repo_root)?;
        let dry_run = cfg!(test);
        if !dry_run {
            let mut process = Command::new(&command[0]);
            process
                .args(&command[1..])
                .env("PLUTUS_PROFILE_ID", &input.profile_id)
                .env(
                    "PLUTUS_PORTFOLIO_ID",
                    input.portfolio_id.clone().unwrap_or_default(),
                )
                .env("PLUTUS_SELECTED_TEAM", &input.selected_team)
                .env("PLUTUS_USER_REQUEST", &input.user_request)
                .env("PLUTUS_WORKSPACE_PATH", &input.workspace_path)
                .env("PLUTUS_REPO_ROOT", repo_root.display().to_string())
                .env(
                    "PLUTUS_APP_DATA_PATH",
                    std::path::Path::new(&input.workspace_path)
                        .parent()
                        .and_then(|path| path.parent())
                        .map(|path| path.display().to_string())
                        .unwrap_or_default(),
                )
                .env("PLUTUS_RUN_ID", &input.run_id)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            let mut child = process
                .spawn()
                .context("failed to start CodexRunHost bridge")?;
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();
            if let Some(stdout) = stdout {
                let paths = AppDataPaths::create(
                    self_runtime_app_data_path(&input.workspace_path)
                        .unwrap_or_else(|| repo_root.join(".plutus")),
                )?;
                spawn_codex_runtime_stream_consumer(
                    input.run_id.clone(),
                    paths,
                    stdout,
                    stderr,
                    child,
                );
            }
            return Ok(CodexRuntimeStarted {
                thread_id: input.run_id,
                runtime: "codex_sdk_run_host".to_string(),
                command,
                events: Vec::new(),
                final_output: None,
            });
        }
        Ok(CodexRuntimeStarted {
            thread_id: format!("codex-thread-{}", input.run_id),
            runtime: "codex_sdk_run_host_dry_run".to_string(),
            command,
            events: Vec::new(),
            final_output: None,
        })
    }
}

fn plutus_repo_root() -> Result<PathBuf> {
    if let Ok(root) = std::env::var("PLUTUS_REPO_ROOT") {
        return Ok(PathBuf::from(root));
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|path| path.parent())
        .and_then(|path| path.parent())
        .map(PathBuf::from)
        .context("failed to resolve Plutus repository root")
}

fn codex_runtime_command(repo_root: &std::path::Path) -> Result<Vec<String>> {
    if let Ok(command) = std::env::var("PLUTUS_CODEX_RUN_HOST_COMMAND") {
        let parts = command
            .split_whitespace()
            .map(ToString::to_string)
            .collect::<Vec<_>>();
        if parts.is_empty() {
            bail!("PLUTUS_CODEX_RUN_HOST_COMMAND is empty");
        }
        return Ok(parts);
    }
    if !repo_root.join("pnpm-workspace.yaml").is_file() {
        bail!("CodexRunHost runtime command is not configured; set PLUTUS_CODEX_RUN_HOST_COMMAND");
    }
    Ok(vec![
        "pnpm".to_string(),
        "--dir".to_string(),
        repo_root.display().to_string(),
        "--filter".to_string(),
        "@plutus/agents".to_string(),
        "start-research-run".to_string(),
        "--json".to_string(),
    ])
}

fn self_runtime_app_data_path(workspace_path: &str) -> Option<PathBuf> {
    std::path::Path::new(workspace_path)
        .parent()
        .and_then(|path| path.parent())
        .map(PathBuf::from)
}
