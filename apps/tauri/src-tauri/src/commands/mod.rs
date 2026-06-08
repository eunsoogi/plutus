use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::{BufRead, BufReader, Read},
    path::{Component, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
};

use crate::audit::record_audit_event;
use crate::remote_control::{
    execute_authorized_remote_command, list_devices, pair_device, revoke_device,
    RemoteCommandExecutionResponse, RemoteCommandRequest, RemoteDevice, RemoteSession,
};
use crate::remote_transport::forward_event_to_paired_sessions;
use crate::secure_store::SecureStore;
use crate::security::{assert_no_trade_tool, redact_secret_values, redact_secrets};
use crate::storage::{
    new_id, now, sha256_hex, AppDataPaths, AppendRunEvent, Artifact, EnqueueLocalJob, FinalOutput,
    LocalJob, NewPosition, NewResearchRun, PersistFinalOutput, PlutusDatabase, Portfolio,
    PortfolioRepository, Position, ResearchRun, RunEvent, Watchlist, WriteArtifactFile,
    MVP_MANUAL_ACCOUNT_ID, MVP_PROFILE_ID,
};

mod provider_holdings;
pub mod trading;
mod trading_catalog;
mod trading_payload;
mod trading_provider_config;
mod trading_provider_sync;
#[cfg(test)]
mod trading_provider_sync_tests;
mod trading_types;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePortfolioInput {
    pub profile_id: String,
    pub name: String,
    pub base_currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartResearchRunInput {
    pub profile_id: String,
    pub portfolio_id: Option<String>,
    pub user_request: String,
    pub selected_team: Option<String>,
}

#[derive(Debug, Clone)]
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

fn self_runtime_app_data_path(workspace_path: &str) -> Option<PathBuf> {
    std::path::Path::new(workspace_path)
        .parent()
        .and_then(|path| path.parent())
        .map(PathBuf::from)
}

fn spawn_codex_runtime_stream_consumer(
    run_id: String,
    paths: AppDataPaths,
    stdout: impl std::io::Read + Send + 'static,
    stderr: Option<impl Read + Send + 'static>,
    mut child: Child,
) {
    thread::spawn(move || {
        let Ok(db) = PlutusDatabase::open(&paths.database) else {
            return;
        };
        let stderr_handle = stderr.map(|stderr| {
            thread::spawn(move || {
                let mut reader = BufReader::new(stderr);
                let mut text = String::new();
                let _ = reader.read_to_string(&mut text);
                text
            })
        });
        let commands = PlutusCommands::new_with_paths(&db, &paths);
        let mut final_persisted = false;
        let mut failure_recorded = false;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Ok(message) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            match message.get("type").and_then(|value| value.as_str()) {
                Some("started") => {
                    if let Some(thread_id) =
                        message.get("threadId").and_then(|value| value.as_str())
                    {
                        let _ = db.conn.execute(
                            "UPDATE research_runs SET codex_thread_id = ?1 WHERE id = ?2",
                            params![thread_id, run_id],
                        );
                    }
                }
                Some("event") => {
                    let event = message.get("event").cloned().unwrap_or_else(|| json!({}));
                    if let Err(error) =
                        append_runtime_event(&db, &run_id, "codex_run_host.stream_event", event)
                    {
                        mark_runtime_failed(
                            &db,
                            &run_id,
                            &format!("failed to persist runtime event: {error}"),
                        );
                        failure_recorded = true;
                    }
                }
                Some("finalOutput") => {
                    if let Some(final_output) = message.get("finalOutput").cloned() {
                        let summary = final_output
                            .get("summary")
                            .and_then(|value| value.as_str())
                            .unwrap_or("CodexRunHost completed the research run.")
                            .to_string();
                        match commands.persist_validated_final_output(PersistFinalOutput {
                            research_run_id: run_id.clone(),
                            summary,
                            structured_output: final_output,
                        }) {
                            Ok(_) => final_persisted = true,
                            Err(error) => {
                                mark_runtime_failed(
                                    &db,
                                    &run_id,
                                    &format!("failed to persist final output: {error}"),
                                );
                                failure_recorded = true;
                            }
                        }
                    }
                }
                Some("failed") => {
                    let _ = db.conn.execute(
                        "UPDATE research_runs SET status = 'failed', completed_at = ?1 WHERE id = ?2",
                        params![now(), run_id],
                    );
                }
                _ => {}
            }
        }
        let stderr_tail = stderr_handle
            .and_then(|handle| handle.join().ok())
            .unwrap_or_default();
        match child.wait() {
            Ok(status) if status.success() && (final_persisted || failure_recorded) => {}
            Ok(_) | Err(_) => {
                let already_completed: i64 = db
                    .conn
                    .query_row(
                        "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                        params![run_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(0);
                if already_completed == 0 {
                    let message = stderr_tail
                        .lines()
                        .rev()
                        .take(5)
                        .collect::<Vec<_>>()
                        .into_iter()
                        .rev()
                        .collect::<Vec<_>>()
                        .join("\n");
                    mark_runtime_failed(
                        &db,
                        &run_id,
                        if message.is_empty() {
                            "CodexRunHost exited without a persisted final output"
                        } else {
                            &message
                        },
                    );
                }
            }
        }
    });
}

fn next_run_event_sequence(db: &PlutusDatabase, run_id: &str) -> Result<i64> {
    let sequence = db.conn.query_row(
        "SELECT COALESCE(MAX(sequence), 0) + 1 FROM research_run_events WHERE research_run_id = ?1",
        params![run_id],
        |row| row.get(0),
    )?;
    Ok(sequence)
}

fn append_runtime_event(
    db: &PlutusDatabase,
    run_id: &str,
    default_event_type: &str,
    payload: Value,
) -> Result<RunEvent> {
    let payload = normalize_runtime_event_payload(db, run_id, payload)?;
    let event_type = payload
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or(default_event_type)
        .to_string();
    db.append_run_event(AppendRunEvent {
        research_run_id: run_id.to_string(),
        sequence: next_run_event_sequence(db, run_id)?,
        event_type,
        payload,
    })
}

fn normalize_runtime_event_payload(
    db: &PlutusDatabase,
    run_id: &str,
    payload: Value,
) -> Result<Value> {
    let profile_id: String = db.conn.query_row(
        "SELECT profile_id FROM research_runs WHERE id = ?1",
        params![run_id],
        |row| row.get(0),
    )?;
    match payload {
        Value::Object(mut object) => {
            object.insert("runId".to_string(), json!(run_id));
            object.insert("profileId".to_string(), json!(profile_id));
            Ok(Value::Object(object))
        }
        value => Ok(json!({
            "runId": run_id,
            "profileId": profile_id,
            "value": value,
        })),
    }
}

fn mark_runtime_failed(db: &PlutusDatabase, run_id: &str, message: &str) {
    let _ = append_runtime_event(
        db,
        run_id,
        "run.failed",
        json!({
            "type": "run.failed",
            "message": message,
        }),
    );
    let _ = db.conn.execute(
        "UPDATE research_runs SET status = 'failed', completed_at = ?1, failure_reason = ?2 WHERE id = ?3 AND status NOT IN ('completed', 'cancelled')",
        params![now(), message, run_id],
    );
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

fn slug_fragment(value: &str) -> String {
    let slug: String = value
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() {
        "run-card".to_string()
    } else {
        slug
    }
}

fn validate_relative_artifact_path(path: &str) -> Result<PathBuf> {
    let candidate = PathBuf::from(path);
    if candidate.is_absolute() {
        bail!("final output artifact path must be relative to run workspace: {path}");
    }
    if candidate.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        bail!("final output artifact path escapes run workspace: {path}");
    }
    Ok(candidate)
}

pub struct PlutusCommands<'a> {
    pub db: &'a PlutusDatabase,
    pub paths: Option<&'a AppDataPaths>,
    pub runtime_bridge: CodexRuntimeBridge,
}

pub(crate) fn db_insert_memory(
    db: &PlutusDatabase,
    memory_id: &str,
    profile_id: &str,
    summary: &str,
    kind: &str,
    tags: &Value,
    source_refs: &Value,
    run_id: &str,
    timestamp: &str,
) -> Result<()> {
    db.conn.execute(
        "INSERT INTO memory_records(id, profile_id, mem0_id, kind, summary, tags, source_refs, capture_policy, sensitivity_class, retention_class, status, created_at, updated_at)
         VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, 'auto_default', 'normal', 'default', 'active', ?7, ?7)",
        params![
            memory_id,
            profile_id,
            kind,
            summary,
            tags.to_string(),
            source_refs.to_string(),
            timestamp
        ],
    )?;
    db.conn.execute(
        "INSERT INTO memory_activity(id, memory_id, event_type, actor, research_run_id, audit_ref, payload, created_at)
         VALUES (?1, ?2, 'memory.captured', 'agent:report_writer', ?3, ?4, ?5, ?6)",
        params![
            new_id(),
            memory_id,
            run_id,
            format!("audit:{run_id}:memory"),
            json!({"summary": summary}).to_string(),
            timestamp
        ],
    )?;
    Ok(())
}

impl<'a> PlutusCommands<'a> {
    pub fn new(db: &'a PlutusDatabase) -> Self {
        Self {
            db,
            paths: None,
            runtime_bridge: CodexRuntimeBridge::default(),
        }
    }

    pub fn new_with_paths(db: &'a PlutusDatabase, paths: &'a AppDataPaths) -> Self {
        Self {
            db,
            paths: Some(paths),
            runtime_bridge: CodexRuntimeBridge::default(),
        }
    }

    pub fn get_app_snapshot(&self, profile_id: &str) -> Result<Value> {
        self.db.ensure_default_profile()?;
        Ok(json!({
            "profileId": profile_id,
            "portfolios": self.load_portfolios_for_snapshot(profile_id)?,
            "watchlists": self.load_watchlists_for_snapshot(profile_id)?,
            "runs": self.load_runs_for_snapshot(profile_id)?,
            "artifacts": self.load_artifacts_for_snapshot(profile_id)?,
            "memoryActivity": self.load_memory_activity_for_snapshot(profile_id)?,
            "wikiPages": self.load_wiki_pages_for_snapshot(profile_id)?,
            "remoteDevices": list_devices(self.db, profile_id)?,
        }))
    }

    pub fn list_portfolios(&self, profile_id: &str) -> Result<Vec<Portfolio>> {
        self.db.list_portfolios(profile_id)
    }

    pub fn create_portfolio(&self, input: CreatePortfolioInput) -> Result<Portfolio> {
        let portfolio =
            self.db
                .create_portfolio(&input.profile_id, &input.name, &input.base_currency)?;
        self.export_local_tool_portfolio_state(&input.profile_id)?;
        record_audit_event(
            self.db,
            Some(&input.profile_id),
            None,
            "user",
            "portfolio.create",
            &portfolio.id,
            &json!({"name": portfolio.name}),
        )?;
        Ok(portfolio)
    }

    pub fn list_watchlists(&self, profile_id: &str) -> Result<Vec<Watchlist>> {
        let mut stmt = self
            .db
            .conn
            .prepare("SELECT id, profile_id, name FROM watchlists WHERE profile_id = ?1")?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(Watchlist {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn start_research_run(&self, input: StartResearchRunInput) -> Result<ResearchRun> {
        let request = redact_secrets(&input.user_request);
        if request.trim().is_empty() {
            bail!("research request cannot be empty");
        }
        if let Some(portfolio_id) = input.portfolio_id.as_deref() {
            let owner_profile_id = self
                .profile_id_for_portfolio(portfolio_id)?
                .context("portfolio not found")?;
            if owner_profile_id != input.profile_id {
                bail!("portfolio outside active profile");
            }
        }
        let selected_team = input
            .selected_team
            .unwrap_or_else(|| "portfolio_review_committee".to_string());
        let mut run = self.db.create_research_run(NewResearchRun {
            profile_id: input.profile_id,
            portfolio_id: input.portfolio_id,
            user_request: request,
            selected_team,
        })?;
        self.export_local_tool_portfolio_state(&run.profile_id)?;
        let workspace_path = self
            .paths
            .map(|paths| paths.run_workspaces.join(&run.id).display().to_string())
            .unwrap_or_else(|| format!("runs/{}", run.id));
        if let Some(paths) = self.paths {
            fs::create_dir_all(paths.run_workspaces.join(&run.id))?;
        }
        let bridge_start = self.runtime_bridge.start(CodexRuntimeStart {
            run_id: run.id.clone(),
            profile_id: run.profile_id.clone(),
            portfolio_id: run.portfolio_id.clone(),
            selected_team: run.selected_team.clone(),
            user_request: run.user_request.clone(),
            workspace_path: workspace_path.clone(),
        })?;
        let codex_thread_id = bridge_start.thread_id;
        let model_config = json!({
            "runtime": bridge_start.runtime,
            "host": "CodexRunHost",
            "startedFrom": "tauri_app_runtime",
            "resumable": true,
            "runtimeCommand": bridge_start.command,
        });
        let custom_agent_versions = json!({
            "portfolio_review_committee": "local",
            "risk_manager": "local",
            "report_writer": "local",
        });
        let config_hash = sha256_hex(
            format!(
                "{}:{}:{}",
                run.selected_team, custom_agent_versions, model_config
            )
            .as_bytes(),
        );
        self.db.conn.execute(
            "UPDATE research_runs
             SET status = 'running',
                 codex_thread_id = ?1,
                 workspace_path = ?2,
                 custom_agent_versions = ?3,
                 local_tool_config_hash = ?4,
                 model_config = ?5
             WHERE id = ?6 AND status NOT IN ('completed', 'failed', 'cancelled')",
            params![
                codex_thread_id,
                workspace_path,
                custom_agent_versions.to_string(),
                config_hash,
                model_config.to_string(),
                run.id
            ],
        )?;
        self.db.append_run_event(AppendRunEvent {
            research_run_id: run.id.clone(),
            sequence: next_run_event_sequence(self.db, &run.id)?,
            event_type: "codex_run_host.started".to_string(),
            payload: json!({
                "runtime": bridge_start.runtime,
                "codexThreadId": codex_thread_id,
                "workspacePath": workspace_path,
                "commandSemantics": "Tauri invoked CodexRunHost runtime bridge",
                "runtimeCommand": bridge_start.command,
            }),
        })?;
        for event in bridge_start.events.iter() {
            let event_json = event.to_string();
            self.db.append_run_event(AppendRunEvent {
                research_run_id: run.id.clone(),
                sequence: next_run_event_sequence(self.db, &run.id)?,
                event_type: event
                    .get("type")
                    .and_then(|value| value.as_str())
                    .unwrap_or("codex_run_host.stream_event")
                    .to_string(),
                payload: event.clone(),
            })?;
            if let Some(paths) = self.paths {
                forward_event_to_paired_sessions(
                    self.db,
                    Some(&paths.secure_storage),
                    &run.profile_id,
                    &event_json,
                )?;
            }
        }
        if let Some(final_output) = bridge_start.final_output {
            self.persist_validated_final_output(PersistFinalOutput {
                research_run_id: run.id.clone(),
                summary: final_output
                    .get("summary")
                    .and_then(|value| value.as_str())
                    .unwrap_or("CodexRunHost completed the research run.")
                    .to_string(),
                structured_output: final_output,
            })?;
            self.db.conn.execute(
                "UPDATE research_runs SET status = 'completed', completed_at = ?1 WHERE id = ?2",
                params![now(), run.id],
            )?;
        }
        if bridge_start.runtime == "codex_sdk_run_host_dry_run" {
            self.persist_deterministic_run_completion(&run.id)?;
        }
        run = self.get_research_run(&run.id)?;
        record_audit_event(
            self.db,
            Some(&run.profile_id),
            Some(&run.id),
            "user",
            "research_run.start",
            &run.id,
            &json!({"selectedTeam": run.selected_team}),
        )?;
        Ok(run)
    }

    fn persist_deterministic_run_completion(&self, run_id: &str) -> Result<()> {
        for (sequence, event_type, payload) in [
            (
                2,
                "stage.started",
                json!({"stage": "plan", "agent": "portfolio_manager"}),
            ),
            (
                3,
                "stage.completed",
                json!({"stage": "ground", "agent": "market_data_researcher"}),
            ),
            (
                4,
                "stage.completed",
                json!({"stage": "execute", "agent": "risk_manager"}),
            ),
            (
                5,
                "run.completed",
                json!({"recommendationCategory": "risk_warning"}),
            ),
        ] {
            self.db.append_run_event(AppendRunEvent {
                research_run_id: run_id.to_string(),
                sequence,
                event_type: event_type.to_string(),
                payload,
            })?;
        }
        self.db.persist_final_output(PersistFinalOutput {
            research_run_id: run_id.to_string(),
            summary: "BTC/NVDA review completed with risk warning: concentration remains elevated and no trade action is authorized.".to_string(),
            structured_output: json!({
                "category": "risk_warning",
                "title": "BTC/NVDA risk review",
                "userRequest": "Review BTC/NVDA exposure and identify risk inspection steps.",
                "selectedTeam": "portfolio_review_committee",
                "riskValidation": "vetoed",
                "summary": "BTC/NVDA review completed with risk warning: concentration remains elevated and no trade action is authorized.",
                "confidence": "medium",
                "warnings": [
                    "BTC and NVDA concentration remains elevated.",
                    "No live trading action is authorized."
                ],
                "evidenceRefs": ["portfolio:core"],
                "supportingEvidence": [
                    {"label": "BTC/NVDA concentration", "sourceRef": "portfolio:core"}
                ],
                "freshness": {"delayStatus": "delayed"},
                "caveats": ["Past performance is not indicative of future results."],
                "assumptions": ["Portfolio data is current enough for a risk review."],
                "dissentingViews": ["No dissenting view recorded."],
                "riskChecklist": [
                    {"check": "Concentration", "status": "warning", "evidenceRefs": ["portfolio:core"]}
                ],
                "artifacts": [],
                "artifactRefs": [],
                "limitations": ["Read-only review; no trade execution is authorized."],
                "nextActions": ["Refresh market data before making allocation decisions."],
                "approvalRequired": true,
                "findings": [
                    "BTC and NVDA concentration remains elevated.",
                    "Past performance is not indicative of future results.",
                    "No live trading action is authorized."
                ],
                "riskVeto": true
            }),
        })?;
        self.persist_post_run_memory_and_wiki(run_id, None)?;
        let artifact = b"# BTC/NVDA risk review\n\nRisk warning: concentration remains elevated. No trade action is authorized.\n";
        if let Some(paths) = self.paths {
            self.db.write_artifact_file(
                paths,
                WriteArtifactFile {
                    research_run_id: run_id.to_string(),
                    artifact_type: "run_card".to_string(),
                    title: "BTC/NVDA risk review".to_string(),
                    mime_type: "text/markdown".to_string(),
                    metadata: json!({"category": "risk_warning"}),
                    created_by_agent: "report_writer".to_string(),
                    contents: artifact.to_vec(),
                },
            )?;
        }
        self.db.conn.execute(
            "UPDATE research_runs SET status = 'completed', recommendation_category = 'risk_warning', completed_at = ?1 WHERE id = ?2",
            params![now(), run_id],
        )?;
        Ok(())
    }

    fn persist_post_run_memory_and_wiki(
        &self,
        run_id: &str,
        final_output: Option<&Value>,
    ) -> Result<()> {
        let run = self.get_research_run(run_id)?;
        let timestamp = now();
        let memory_id = new_id();
        let category = final_output
            .and_then(|value| {
                value
                    .get("recommendationCategory")
                    .or_else(|| value.get("category"))
                    .and_then(|category| category.as_str())
            })
            .unwrap_or("risk_warning");
        let title = final_output
            .and_then(|value| value.get("title").and_then(|title| title.as_str()))
            .unwrap_or("BTC/NVDA risk review");
        let summary = final_output
            .and_then(|value| value.get("summary").and_then(|summary| summary.as_str()))
            .unwrap_or("Concentration risk remains elevated; no trade action is authorized.");
        let source_refs = final_output
            .and_then(|value| {
                value
                    .get("evidenceRefs")
                    .or_else(|| value.get("evidence"))
                    .cloned()
            })
            .unwrap_or_else(|| json!([{"type": "run", "id": run_id}]));
        let tags = json!(["run_card", category]);
        db_insert_memory(
            self.db,
            &memory_id,
            &run.profile_id,
            summary,
            category,
            &tags,
            &source_refs,
            run_id,
            &timestamp,
        )?;
        let wiki_id = new_id();
        let revision_id = new_id();
        self.db.conn.execute(
            "INSERT INTO wiki_pages(id, profile_id, slug, category, title, summary, status, current_revision_id, tags, source_refs, memory_refs, freshness, confidence, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'risk_lesson', ?4, ?5, 'active', ?6, ?7, ?8, ?9, 'current', 'medium', ?10, ?10)",
            params![
                wiki_id,
                run.profile_id,
                format!("{}-{run_id}", slug_fragment(title)),
                title,
                summary,
                revision_id,
                tags.to_string(),
                source_refs.to_string(),
                json!([memory_id]).to_string(),
                timestamp
            ],
        )?;
        self.db.conn.execute(
            "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
             VALUES (?1, ?2, 1, ?3, ?4, 'Post-run wiki maintenance', ?5, '[]', 'agent:llm_wiki_curator', ?6, ?7)",
            params![
                revision_id,
                wiki_id,
                format!("wiki/{wiki_id}.md"),
                sha256_hex(format!("{run_id}:{memory_id}:{summary}").as_bytes()),
                source_refs.to_string(),
                format!("audit:{run_id}:wiki"),
                timestamp
            ],
        )?;
        if let Some(paths) = self.paths {
            let content =
                format!("# {title}\n\n{summary}\n\nSource run: {run_id}\nMemory: {memory_id}\n");
            fs::write(paths.wiki.join(format!("{wiki_id}.md")), content)
                .with_context(|| format!("failed to write wiki markdown for {wiki_id}"))?;
        }
        Ok(())
    }

    pub fn get_research_run(&self, run_id: &str) -> Result<ResearchRun> {
        self.db
            .conn
            .query_row(
                "SELECT id, profile_id, portfolio_id, status, user_request, selected_team, codex_thread_id, workspace_path, recommendation_category FROM research_runs WHERE id = ?1",
                params![run_id],
                |row| {
                    Ok(ResearchRun {
                        id: row.get(0)?,
                        profile_id: row.get(1)?,
                        portfolio_id: row.get(2)?,
                        status: row.get(3)?,
                        user_request: row.get(4)?,
                        selected_team: row.get(5)?,
                        codex_thread_id: row.get(6)?,
                        workspace_path: row.get(7)?,
                        recommendation_category: row.get(8)?,
                    })
                },
            )
            .optional()?
            .context("research run not found")
    }

    pub fn get_research_run_for_profile(
        &self,
        run_id: &str,
        profile_id: &str,
    ) -> Result<ResearchRun> {
        let run = self.get_research_run(run_id)?;
        if run.profile_id != profile_id {
            bail!("research run outside active profile");
        }
        Ok(run)
    }

    pub fn cancel_research_run(&self, run_id: &str, profile_id: &str) -> Result<()> {
        let affected = self.db.conn.execute(
            "UPDATE research_runs SET status = 'cancelled', completed_at = ?1 WHERE id = ?2 AND profile_id = ?3 AND status NOT IN ('completed', 'failed')",
            params![now(), run_id, profile_id],
        )?;
        if affected == 0 {
            self.get_research_run_for_profile(run_id, profile_id)?;
        }
        Ok(())
    }

    pub fn get_artifact(&self, artifact_id: &str) -> Result<Artifact> {
        self.db
            .conn
            .query_row(
                "SELECT id, research_run_id, artifact_type, title, storage_key, content_hash, mime_type FROM agent_artifacts WHERE id = ?1",
                params![artifact_id],
                |row| {
                    Ok(Artifact {
                        id: row.get(0)?,
                        research_run_id: row.get(1)?,
                        artifact_type: row.get(2)?,
                        title: row.get(3)?,
                        storage_key: row.get(4)?,
                        content_hash: row.get(5)?,
                        mime_type: row.get(6)?,
                    })
                },
            )
            .optional()?
            .context("artifact not found")
    }

    pub fn get_artifact_for_profile(
        &self,
        artifact_id: &str,
        profile_id: &str,
    ) -> Result<Artifact> {
        let artifact = self.get_artifact(artifact_id)?;
        let run = self.get_research_run(&artifact.research_run_id)?;
        if run.profile_id != profile_id {
            bail!("artifact outside active profile");
        }
        Ok(artifact)
    }

    pub fn get_artifact_for_profile_and_run(
        &self,
        artifact_id: &str,
        profile_id: &str,
        run_id: Option<&str>,
    ) -> Result<Artifact> {
        let artifact = self.get_artifact_for_profile(artifact_id, profile_id)?;
        if let Some(run_id) = run_id {
            if artifact.research_run_id != run_id {
                bail!("artifact outside requested run");
            }
        }
        Ok(artifact)
    }

    fn artifact_ref_exists(&self, run_id: &str, artifact_ref: &str) -> Result<bool> {
        let count: i64 = self.db.conn.query_row(
            "SELECT COUNT(*) FROM agent_artifacts WHERE research_run_id = ?1 AND (id = ?2 OR title = ?2 OR storage_key = ?2)",
            params![run_id, artifact_ref],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn get_portfolio_snapshot(&self, portfolio_id: &str) -> Result<Value> {
        let portfolio = self.db.conn.query_row(
            "SELECT id, profile_id, name, base_currency, benchmark_id, risk_profile, created_at, updated_at FROM portfolios WHERE id = ?1",
            params![portfolio_id],
            |row| {
                let risk_profile: String = row.get(5)?;
                Ok(Portfolio {
                    id: row.get(0)?,
                    profile_id: row.get(1)?,
                    name: row.get(2)?,
                    base_currency: row.get(3)?,
                    benchmark_id: row.get(4)?,
                    risk_profile: serde_json::from_str(&risk_profile).unwrap_or_else(|_| json!({})),
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        ).optional()?.context("portfolio not found")?;
        let mut stmt = self.db.conn.prepare(
            "SELECT p.id, i.display_symbol, p.quantity, p.average_cost, p.cost_currency, p.thesis
             FROM positions p JOIN instruments i ON i.id = p.instrument_id
             WHERE p.portfolio_id = ?1 ORDER BY i.display_symbol",
        )?;
        let positions = stmt
            .query_map(params![portfolio_id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "symbol": row.get::<_, String>(1)?,
                    "quantity": row.get::<_, f64>(2)?,
                    "averageCost": row.get::<_, f64>(3)?,
                    "costCurrency": row.get::<_, String>(4)?,
                    "thesis": row.get::<_, String>(5)?,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(json!({"portfolio": portfolio, "positions": positions, "hostTimestamp": now()}))
    }

    pub fn get_portfolio_snapshot_for_profile(
        &self,
        portfolio_id: &str,
        profile_id: &str,
    ) -> Result<Value> {
        let owner_profile_id = self
            .profile_id_for_portfolio(portfolio_id)?
            .context("portfolio not found")?;
        if owner_profile_id != profile_id {
            bail!("portfolio outside active profile");
        }
        self.get_portfolio_snapshot(portfolio_id)
    }

    pub fn add_portfolio_position(&self, input: PositionInput) -> Result<Position> {
        let portfolio_id = input.portfolio_id.clone();
        let owner_profile_id = self
            .profile_id_for_portfolio(&portfolio_id)?
            .context("portfolio not found")?;
        if owner_profile_id != input.profile_id {
            bail!("portfolio outside active profile");
        }
        let instrument_id = self.resolve_instrument_id(&input.symbol)?;
        let position = self.db.add_position(NewPosition {
            portfolio_id: input.portfolio_id,
            account_id: input
                .account_id
                .unwrap_or_else(|| MVP_MANUAL_ACCOUNT_ID.to_string()),
            instrument_id,
            quantity: input.quantity,
            average_cost: input.average_cost,
            cost_currency: input.cost_currency.unwrap_or_else(|| "USD".to_string()),
            thesis: input.thesis.unwrap_or_default(),
        })?;
        self.export_local_tool_portfolio_state(&owner_profile_id)?;
        Ok(position)
    }

    pub fn update_portfolio_position(&self, input: UpdatePositionInput) -> Result<Position> {
        let existing_position = self.load_position(&input.position_id)?;
        let owner_profile_id = self
            .profile_id_for_portfolio(&existing_position.portfolio_id)?
            .context("portfolio not found")?;
        if owner_profile_id != input.profile_id {
            bail!("position outside active profile");
        }
        if let Some(quantity) = input.quantity {
            self.db.conn.execute(
                "UPDATE positions SET quantity = ?1, updated_at = ?2 WHERE id = ?3",
                params![quantity, now(), input.position_id],
            )?;
        }
        if let Some(thesis) = input.thesis.as_deref() {
            self.db.update_position_thesis(&input.position_id, thesis)?;
        }
        let position = self.load_position(&input.position_id)?;
        self.export_local_tool_portfolio_state(&owner_profile_id)?;
        Ok(position)
    }

    pub fn create_watchlist(&self, input: CreateWatchlistInput) -> Result<Watchlist> {
        let watchlist = Watchlist {
            id: new_id(),
            profile_id: input.profile_id,
            name: input.name,
        };
        self.db.conn.execute(
            "INSERT INTO watchlists(id, profile_id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![watchlist.id, watchlist.profile_id, watchlist.name, now()],
        )?;
        self.export_local_tool_portfolio_state(&watchlist.profile_id)?;
        Ok(watchlist)
    }

    pub fn add_watchlist_item(&self, input: WatchlistItemInput) -> Result<Value> {
        let watchlist_id = input.watchlist_id.clone();
        let owner_profile_id = self
            .profile_id_for_watchlist(&watchlist_id)?
            .context("watchlist not found")?;
        if owner_profile_id != input.profile_id {
            bail!("watchlist outside active profile");
        }
        let instrument_id = self.resolve_instrument_id(&input.symbol)?;
        let id = new_id();
        let timestamp = now();
        self.db.conn.execute(
            "INSERT INTO watchlist_items(id, watchlist_id, instrument_id, trigger_note, target_zone, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![
                id,
                input.watchlist_id,
                instrument_id,
                input.trigger_note.unwrap_or_default(),
                input.target_zone.unwrap_or_else(|| "watch".to_string()),
                timestamp
            ],
        )?;
        let item = self.load_watchlist_item(&id)?;
        self.export_local_tool_portfolio_state(&owner_profile_id)?;
        Ok(item)
    }

    pub fn update_watchlist_item(&self, input: UpdateWatchlistItemInput) -> Result<Value> {
        let owner_profile_id = self
            .profile_id_for_watchlist_item(&input.item_id)?
            .context("watchlist item not found")?;
        if owner_profile_id != input.profile_id {
            bail!("watchlist item outside active profile");
        }
        if let Some(trigger_note) = input.trigger_note {
            self.db.conn.execute(
                "UPDATE watchlist_items SET trigger_note = ?1, updated_at = ?2 WHERE id = ?3",
                params![trigger_note, now(), input.item_id],
            )?;
        }
        if let Some(target_zone) = input.target_zone {
            self.db.conn.execute(
                "UPDATE watchlist_items SET target_zone = ?1, updated_at = ?2 WHERE id = ?3",
                params![target_zone, now(), input.item_id],
            )?;
        }
        let item = self.load_watchlist_item(&input.item_id)?;
        self.export_local_tool_portfolio_state(&owner_profile_id)?;
        Ok(item)
    }

    pub fn open_local_artifact_file(&self, artifact_id: &str) -> Result<Value> {
        let artifact = self.get_artifact(artifact_id)?;
        let path = self
            .paths
            .map(|paths| paths.root.join(&artifact.storage_key).display().to_string())
            .unwrap_or(artifact.storage_key);
        record_audit_event(
            self.db,
            None,
            Some(&artifact.research_run_id),
            "user",
            "artifact.open_local_file",
            artifact_id,
            &json!({"path": path}),
        )?;
        Ok(json!({"opened": true, "path": path, "hostTimestamp": now()}))
    }

    pub fn open_local_artifact_file_for_profile(
        &self,
        artifact_id: &str,
        profile_id: &str,
        run_id: Option<&str>,
    ) -> Result<Value> {
        self.get_artifact_for_profile_and_run(artifact_id, profile_id, run_id)?;
        self.open_local_artifact_file(artifact_id)
    }

    pub fn persist_validated_final_output(&self, input: PersistFinalOutput) -> Result<FinalOutput> {
        let mut structured = input.structured_output;
        if structured.get("recommendationCategory").is_none() {
            if let Some(category) = structured.get("category").cloned() {
                structured["recommendationCategory"] = category;
            }
        }
        let run_id = input.research_run_id.clone();
        let profile_id: String = self.db.conn.query_row(
            "SELECT profile_id FROM research_runs WHERE id = ?1",
            params![run_id],
            |row| row.get(0),
        )?;
        structured["runId"] = json!(run_id.clone());
        structured["profileId"] = json!(profile_id);
        validate_final_output(&mut structured)?;
        let mut artifact_path_contents: Vec<(String, Vec<u8>)> = Vec::new();
        if let Some(artifact_paths) = structured
            .get("artifactPaths")
            .and_then(|value| value.as_array())
        {
            let paths = self
                .paths
                .context("final output artifactPaths require app data paths")?;
            let workspace = paths.run_workspaces.join(&run_id);
            let canonical_workspace = workspace
                .canonicalize()
                .with_context(|| format!("run workspace not found: {}", workspace.display()))?;
            for value in artifact_paths {
                let path = value
                    .as_str()
                    .context("final output artifactPaths must contain string values")?;
                let relative = validate_relative_artifact_path(path)?;
                let source = workspace.join(&relative);
                let canonical_source = source
                    .canonicalize()
                    .with_context(|| format!("final output artifact path not found: {path}"))?;
                if !canonical_source.starts_with(&canonical_workspace) {
                    bail!("final output artifact path escapes run workspace: {path}");
                }
                let contents = fs::read(&canonical_source).with_context(|| {
                    format!(
                        "failed to read final output artifact {}",
                        canonical_source.display()
                    )
                })?;
                artifact_path_contents.push((path.to_string(), contents));
            }
        }
        if let Some(refs) = structured
            .get("artifactRefs")
            .and_then(|value| value.as_array())
        {
            for value in refs {
                let artifact_ref = value
                    .as_str()
                    .context("final output artifactRefs must contain string values")?;
                if self.artifact_ref_exists(&run_id, artifact_ref)? {
                    continue;
                }
                let artifact_path =
                    artifact_path_for_ref(&structured, artifact_ref).with_context(|| {
                        format!("final output artifactRef not found: {artifact_ref}")
                    })?;
                let paths = self
                    .paths
                    .context("final output artifact refs with paths require app data paths")?;
                let workspace = paths.run_workspaces.join(&run_id);
                let canonical_workspace = workspace
                    .canonicalize()
                    .with_context(|| format!("run workspace not found: {}", workspace.display()))?;
                let relative = validate_relative_artifact_path(&artifact_path)?;
                let source = workspace.join(&relative);
                let canonical_source = source.canonicalize().with_context(|| {
                    format!("final output artifact path not found: {artifact_path}")
                })?;
                if !canonical_source.starts_with(&canonical_workspace) {
                    bail!("final output artifact path escapes run workspace: {artifact_path}");
                }
                let contents = fs::read(&canonical_source).with_context(|| {
                    format!(
                        "failed to read final output artifact {}",
                        canonical_source.display()
                    )
                })?;
                artifact_path_contents.push((artifact_path, contents));
            }
        }
        let normalized_input = PersistFinalOutput {
            research_run_id: run_id,
            summary: input.summary,
            structured_output: structured.clone(),
        };
        let output = FinalOutput {
            id: new_id(),
            research_run_id: normalized_input.research_run_id,
            summary: normalized_input.summary,
            structured_output: normalized_input.structured_output,
            created_at: now(),
        };
        self.db.conn.execute("BEGIN IMMEDIATE", [])?;
        let persist_result = (|| -> Result<()> {
            if let Some(paths) = self.paths {
                for (path, contents) in artifact_path_contents {
                    self.db.write_artifact_file(
                        paths,
                        WriteArtifactFile {
                            research_run_id: output.research_run_id.clone(),
                            artifact_type: "final_output_path".to_string(),
                            title: path.to_string(),
                            mime_type: "application/octet-stream".to_string(),
                            metadata: json!({"source": "final_output", "sourcePath": path}),
                            created_by_agent: "report_writer".to_string(),
                            contents,
                        },
                    )?;
                }
            }
            self.persist_post_run_memory_and_wiki(
                &output.research_run_id,
                Some(&output.structured_output),
            )?;
            record_audit_event(
                self.db,
                None,
                Some(&output.research_run_id),
                "system",
                "research_run.final_output",
                &output.id,
                &json!({"recommendationCategory": output.structured_output.get("recommendationCategory")}),
            )?;
            self.db.conn.execute(
                "INSERT INTO research_run_final_outputs(id, research_run_id, summary, structured_output, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    output.id,
                    output.research_run_id,
                    output.summary,
                    output.structured_output.to_string(),
                    output.created_at
                ],
            )?;
            self.db.conn.execute(
                "UPDATE research_runs SET status = 'completed', completed_at = ?1, recommendation_category = ?2 WHERE id = ?3",
                params![
                    output.created_at,
                    output
                        .structured_output
                        .get("recommendationCategory")
                        .and_then(|value| value.as_str()),
                    output.research_run_id
                ],
            )?;
            Ok(())
        })();
        if let Err(error) = persist_result {
            let _ = self.db.conn.execute("ROLLBACK", []);
            return Err(error);
        }
        self.db.conn.execute("COMMIT", [])?;
        Ok(output)
    }

    pub fn list_memory_activity(&self, profile_id: &str, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, memory_id, event_type, actor, research_run_id, payload, created_at
             FROM memory_activity ma
             LEFT JOIN memory_records mr ON mr.id = ma.memory_id
             LEFT JOIN research_runs rr ON rr.id = ma.research_run_id
             WHERE mr.profile_id = ?1 OR rr.profile_id = ?1
             ORDER BY ma.created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![profile_id, limit], |row| {
            let payload: String = row.get(5)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "memoryId": row.get::<_, Option<String>>(1)?,
                "eventType": row.get::<_, String>(2)?,
                "actor": row.get::<_, String>(3)?,
                "researchRunId": row.get::<_, Option<String>>(4)?,
                "payload": serde_json::from_str::<Value>(&payload).unwrap_or_else(|_| json!({})),
                "createdAt": row.get::<_, String>(6)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn update_memory(&self, memory_id: &str, profile_id: &str, patch: Value) -> Result<Value> {
        self.load_memory_for_profile(memory_id, profile_id)?;
        let summary = patch.get("summary").and_then(|value| value.as_str());
        let status = patch.get("status").and_then(|value| value.as_str());
        if let Some(summary) = summary {
            self.db.conn.execute(
                "UPDATE memory_records SET summary = ?1, updated_at = ?2 WHERE id = ?3 AND profile_id = ?4",
                params![summary, now(), memory_id, profile_id],
            )?;
        }
        if let Some(status) = status {
            self.db.conn.execute(
                "UPDATE memory_records SET status = ?1, updated_at = ?2 WHERE id = ?3 AND profile_id = ?4",
                params![status, now(), memory_id, profile_id],
            )?;
        }
        self.record_memory_activity(Some(memory_id), "memory.updated", patch)?;
        self.load_memory_for_profile(memory_id, profile_id)
    }

    pub fn archive_memory(&self, memory_id: &str, profile_id: &str, reason: &str) -> Result<()> {
        self.load_memory_for_profile(memory_id, profile_id)?;
        self.db.conn.execute(
            "UPDATE memory_records SET status = 'archived', retention_class = 'archived', updated_at = ?1 WHERE id = ?2 AND profile_id = ?3",
            params![now(), memory_id, profile_id],
        )?;
        self.record_memory_activity(
            Some(memory_id),
            "memory.archived",
            json!({"reason": reason}),
        )?;
        Ok(())
    }

    pub fn forget_memory(&self, memory_id: &str, profile_id: &str) -> Result<()> {
        self.load_memory_for_profile(memory_id, profile_id)?;
        self.db.conn.execute(
            "UPDATE memory_records SET status = 'deleted', deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND profile_id = ?3",
            params![now(), memory_id, profile_id],
        )?;
        self.record_memory_activity(Some(memory_id), "memory.deleted", json!({}))?;
        Ok(())
    }

    pub fn set_memory_category_enabled(&self, category: &str, enabled: bool) -> Result<()> {
        self.record_memory_activity(
            None,
            "memory.category_enabled",
            json!({"category": category, "enabled": enabled}),
        )?;
        Ok(())
    }

    pub fn list_wiki_pages(&self, profile_id: &str, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, slug, category, title, summary, freshness, confidence, updated_at FROM wiki_pages WHERE profile_id = ?1 ORDER BY updated_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![profile_id, limit], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "slug": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "title": redact_secrets(&row.get::<_, String>(3)?),
                "summary": row.get::<_, String>(4)?,
                "freshness": row.get::<_, String>(5)?,
                "confidence": row.get::<_, String>(6)?,
                "updatedAt": row.get::<_, String>(7)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn get_wiki_page(&self, page_id: &str, profile_id: &str) -> Result<Value> {
        self.db.conn.query_row(
            "SELECT id, slug, category, title, summary, freshness, confidence, current_revision_id FROM wiki_pages WHERE id = ?1 AND profile_id = ?2",
            params![page_id, profile_id],
            |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "slug": row.get::<_, String>(1)?,
                    "category": row.get::<_, String>(2)?,
                    "title": row.get::<_, String>(3)?,
                    "summary": row.get::<_, String>(4)?,
                    "freshness": row.get::<_, String>(5)?,
                    "confidence": row.get::<_, String>(6)?,
                    "currentRevisionId": row.get::<_, Option<String>>(7)?,
                }))
            },
        ).optional()?.context("wiki page not found")
    }

    pub fn list_wiki_activity(&self, profile_id: &str, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT wr.id, wr.wiki_page_id, wr.revision_number, wr.revision_note, wr.created_by, wr.created_at
             FROM wiki_revisions wr
             JOIN wiki_pages wp ON wp.id = wr.wiki_page_id
             WHERE wp.profile_id = ?1
             ORDER BY wr.created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![profile_id, limit], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "pageId": row.get::<_, String>(1)?,
                "revisionNumber": row.get::<_, i64>(2)?,
                "revisionNote": row.get::<_, String>(3)?,
                "createdBy": row.get::<_, String>(4)?,
                "createdAt": row.get::<_, String>(5)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn revert_wiki_revision(
        &self,
        page_id: &str,
        revision_id: &str,
        reason: &str,
    ) -> Result<Value> {
        let now = now();
        let new_revision_id = new_id();
        let (storage_key, content_hash, source_refs, contradiction_refs, next_revision_number): (
            String,
            String,
            String,
            String,
            i64,
        ) = self
            .db
            .conn
            .query_row(
                "SELECT target.storage_key,
                    target.content_hash,
                    target.source_refs,
                    target.contradiction_refs,
                    COALESCE(MAX(existing.revision_number), 0) + 1
             FROM wiki_revisions target
             JOIN wiki_revisions existing ON existing.wiki_page_id = target.wiki_page_id
             WHERE target.id = ?1 AND target.wiki_page_id = ?2",
                params![revision_id, page_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
            .optional()?
            .context("wiki revision not found")?;
        self.db.conn.execute(
            "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'user', NULL, ?9)",
            params![
                new_revision_id,
                page_id,
                next_revision_number,
                storage_key,
                content_hash,
                format!("Revert: {reason}"),
                source_refs,
                contradiction_refs,
                now,
            ],
        )?;
        self.db.conn.execute(
            "UPDATE wiki_pages SET current_revision_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_revision_id, now, page_id],
        )?;
        record_audit_event(
            self.db,
            None,
            None,
            "user",
            "wiki.revert_revision",
            page_id,
            &json!({"revisionId": revision_id, "newRevisionId": new_revision_id, "reason": reason}),
        )?;
        let profile_id = self
            .profile_id_for_wiki_page(page_id)?
            .context("wiki page not found")?;
        self.get_wiki_page(page_id, &profile_id)
    }

    pub fn assert_command_surface_safe(&self, command_name: &str) -> Result<()> {
        assert_no_trade_tool(command_name)
    }

    fn resolve_instrument_id(&self, symbol: &str) -> Result<String> {
        self.db
            .conn
            .query_row(
                "SELECT id FROM instruments WHERE display_symbol = ?1 OR canonical_symbol = ?1 LIMIT 1",
                params![symbol],
                |row| row.get(0),
            )
            .optional()?
            .with_context(|| format!("instrument not found for symbol {symbol}"))
    }

    fn load_position(&self, position_id: &str) -> Result<Position> {
        self.db
            .conn
            .query_row(
                "SELECT id, portfolio_id, account_id, instrument_id, quantity, average_cost, cost_currency, thesis FROM positions WHERE id = ?1",
                params![position_id],
                |row| {
                    Ok(Position {
                        id: row.get(0)?,
                        portfolio_id: row.get(1)?,
                        account_id: row.get(2)?,
                        instrument_id: row.get(3)?,
                        quantity: row.get(4)?,
                        average_cost: row.get(5)?,
                        cost_currency: row.get(6)?,
                        thesis: row.get(7)?,
                    })
                },
            )
            .optional()?
            .context("position not found")
    }

    fn load_watchlist_item(&self, item_id: &str) -> Result<Value> {
        self.db
            .conn
            .query_row(
                "SELECT wi.id, wi.watchlist_id, i.display_symbol, wi.trigger_note, wi.target_zone
             FROM watchlist_items wi JOIN instruments i ON i.id = wi.instrument_id
             WHERE wi.id = ?1",
                params![item_id],
                |row| {
                    Ok(json!({
                        "id": row.get::<_, String>(0)?,
                        "watchlistId": row.get::<_, String>(1)?,
                        "symbol": row.get::<_, String>(2)?,
                        "triggerNote": row.get::<_, String>(3)?,
                        "targetZone": row.get::<_, String>(4)?,
                    }))
                },
            )
            .optional()?
            .context("watchlist item not found")
    }

    fn load_portfolios_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, profile_id, name, base_currency, benchmark_id FROM portfolios WHERE profile_id = ?1 ORDER BY updated_at DESC, name",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let portfolio_id: String = row.get(0)?;
            let mut position_stmt = self.db.conn.prepare(
                "SELECT p.id, i.display_symbol, i.name, p.quantity, p.average_cost, p.cost_currency, p.thesis
                 FROM positions p
                 JOIN instruments i ON i.id = p.instrument_id
                 WHERE p.portfolio_id = ?1
                 ORDER BY i.display_symbol",
            )?;
            let positions = position_stmt
                .query_map(params![portfolio_id], |position_row| {
                    Ok(json!({
                        "id": position_row.get::<_, String>(0)?,
                        "symbol": position_row.get::<_, String>(1)?,
                        "name": position_row.get::<_, String>(2)?,
                        "quantity": position_row.get::<_, f64>(3)?,
                        "averageCost": position_row.get::<_, f64>(4)?,
                        "costCurrency": position_row.get::<_, String>(5)?,
                        "thesis": redact_secrets(&position_row.get::<_, String>(6)?),
                    }))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(json!({
                "id": portfolio_id,
                "profileId": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "baseCurrency": row.get::<_, String>(3)?,
                "benchmarkId": row.get::<_, Option<String>>(4)?,
                "positions": positions,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn load_watchlists_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, profile_id, name FROM watchlists WHERE profile_id = ?1 ORDER BY updated_at DESC, name",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let watchlist_id: String = row.get(0)?;
            let mut item_stmt = self.db.conn.prepare(
                "SELECT wi.id, i.display_symbol, wi.trigger_note, wi.target_zone
                 FROM watchlist_items wi
                 JOIN instruments i ON i.id = wi.instrument_id
                 WHERE wi.watchlist_id = ?1
                 ORDER BY i.display_symbol",
            )?;
            let items = item_stmt
                .query_map(params![watchlist_id], |item_row| {
                    Ok(json!({
                        "id": item_row.get::<_, String>(0)?,
                        "symbol": item_row.get::<_, String>(1)?,
                        "triggerNote": redact_secrets(&item_row.get::<_, String>(2)?),
                        "targetZone": redact_secrets(&item_row.get::<_, String>(3)?),
                    }))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(json!({
                "id": watchlist_id,
                "profileId": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "items": items,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn load_runs_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT rr.id, rr.profile_id, rr.portfolio_id, rr.status, rr.user_request, rr.selected_team, rr.recommendation_category, rr.confidence, rr.started_at, rr.completed_at,
                    (
                        SELECT rfo.structured_output
                        FROM research_run_final_outputs rfo
                        WHERE rfo.research_run_id = rr.id
                        ORDER BY rfo.created_at DESC
                        LIMIT 1
                    )
             FROM research_runs
             rr
             WHERE rr.profile_id = ?1
             ORDER BY rr.started_at DESC
             LIMIT 25",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let final_card_raw: Option<String> = row.get(10)?;
            let final_card = final_card_raw
                .as_deref()
                .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
                .map(|value| redact_secret_values(&value));
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "profileId": row.get::<_, String>(1)?,
                "portfolioId": row.get::<_, Option<String>>(2)?,
                "status": row.get::<_, String>(3)?,
                "title": row.get::<_, String>(4)?,
                "selectedTeam": row.get::<_, String>(5)?,
                "category": row.get::<_, Option<String>>(6)?,
                "confidence": row.get::<_, Option<String>>(7)?,
                "startedAt": row.get::<_, String>(8)?,
                "completedAt": row.get::<_, Option<String>>(9)?,
                "finalCard": final_card,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn load_artifacts_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT a.id, a.research_run_id, a.artifact_type, a.title, a.mime_type, a.created_at
             FROM agent_artifacts a
             JOIN research_runs r ON r.id = a.research_run_id
             WHERE r.profile_id = ?1
             ORDER BY a.created_at DESC
             LIMIT 50",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "researchRunId": row.get::<_, String>(1)?,
                "type": row.get::<_, String>(2)?,
                "title": redact_secrets(&row.get::<_, String>(3)?),
                "mimeType": row.get::<_, String>(4)?,
                "createdAt": row.get::<_, String>(5)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn load_memory_activity_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT ma.id, ma.memory_id, ma.event_type, ma.actor, ma.research_run_id, ma.payload, ma.created_at
             FROM memory_activity ma
             LEFT JOIN memory_records mr ON mr.id = ma.memory_id
             LEFT JOIN research_runs rr ON rr.id = ma.research_run_id
             WHERE mr.profile_id = ?1 OR rr.profile_id = ?1
             ORDER BY ma.created_at DESC
             LIMIT 50",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let payload: String = row.get(5)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "memoryId": row.get::<_, Option<String>>(1)?,
                "eventType": row.get::<_, String>(2)?,
                "actor": row.get::<_, String>(3)?,
                "researchRunId": row.get::<_, Option<String>>(4)?,
                "payload": redact_secret_values(
                    &serde_json::from_str::<Value>(&payload).unwrap_or_else(|_| json!({}))
                ),
                "createdAt": row.get::<_, String>(6)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn load_wiki_pages_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT wp.id, wp.slug, wp.category, wp.title, wp.summary, wp.freshness, wp.confidence, wp.current_revision_id, wp.source_refs, wp.updated_at, wr.revision_note
             FROM wiki_pages wp
             LEFT JOIN wiki_revisions wr ON wr.id = wp.current_revision_id
             WHERE wp.profile_id = ?1
             ORDER BY wp.updated_at DESC
             LIMIT 50",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let source_refs: String = row.get(8)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "slug": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "title": redact_secrets(&row.get::<_, String>(3)?),
                "summary": redact_secrets(&row.get::<_, String>(4)?),
                "freshness": row.get::<_, String>(5)?,
                "confidence": row.get::<_, String>(6)?,
                "currentRevisionId": row.get::<_, Option<String>>(7)?,
                "sourceRefs": redact_secret_values(
                    &serde_json::from_str::<Value>(&source_refs).unwrap_or_else(|_| json!([]))
                ),
                "revisionNote": row.get::<_, Option<String>>(10)?.map(|note| redact_secrets(&note)),
                "updatedAt": row.get::<_, String>(9)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn profile_id_for_portfolio(&self, portfolio_id: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT profile_id FROM portfolios WHERE id = ?1",
                params![portfolio_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }

    fn profile_id_for_watchlist(&self, watchlist_id: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT profile_id FROM watchlists WHERE id = ?1",
                params![watchlist_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }

    fn profile_id_for_watchlist_item(&self, item_id: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT w.profile_id FROM watchlist_items wi JOIN watchlists w ON w.id = wi.watchlist_id WHERE wi.id = ?1",
                params![item_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }

    fn profile_id_for_wiki_page(&self, page_id: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT profile_id FROM wiki_pages WHERE id = ?1",
                params![page_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }

    fn export_local_tool_portfolio_state(&self, profile_id: &str) -> Result<()> {
        let Some(paths) = self.paths else {
            return Ok(());
        };
        let mut portfolio_stmt = self.db.conn.prepare(
            "SELECT id, profile_id, name, base_currency, benchmark_id FROM portfolios WHERE profile_id = ?1 ORDER BY name",
        )?;
        let portfolios = portfolio_stmt
            .query_map(params![profile_id], |row| {
                let portfolio_id: String = row.get(0)?;
                let mut position_stmt = self.db.conn.prepare(
                    "SELECT p.id, p.portfolio_id, p.account_id, p.instrument_id, i.display_symbol, p.quantity, p.average_cost, p.cost_currency, p.thesis
                     FROM positions p JOIN instruments i ON i.id = p.instrument_id
                     WHERE p.portfolio_id = ?1 ORDER BY i.display_symbol",
                )?;
                let positions = position_stmt
                    .query_map(params![portfolio_id], |position_row| {
                        Ok(json!({
                            "id": position_row.get::<_, String>(0)?,
                            "portfolioId": position_row.get::<_, String>(1)?,
                            "accountId": position_row.get::<_, String>(2)?,
                            "instrumentId": position_row.get::<_, String>(3)?,
                            "symbol": position_row.get::<_, String>(4)?,
                            "quantity": position_row.get::<_, f64>(5)?,
                            "averageCost": position_row.get::<_, f64>(6)?,
                            "costCurrency": position_row.get::<_, String>(7)?,
                            "thesis": redact_secrets(&position_row.get::<_, String>(8)?),
                            "riskBucket": "core",
                            "tags": [],
                            "acquiredAt": "2026-01-01",
                        }))
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(json!({
                    "id": portfolio_id,
                    "profileId": row.get::<_, String>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "baseCurrency": row.get::<_, String>(3)?,
                    "benchmarkId": row.get::<_, Option<String>>(4)?,
                    "positions": positions,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut watchlist_stmt = self.db.conn.prepare(
            "SELECT id, profile_id, name FROM watchlists WHERE profile_id = ?1 ORDER BY name",
        )?;
        let watchlists = watchlist_stmt
            .query_map(params![profile_id], |row| {
                let watchlist_id: String = row.get(0)?;
                let mut item_stmt = self.db.conn.prepare(
                    "SELECT wi.id, wi.watchlist_id, i.id, i.display_symbol, wi.trigger_note, wi.target_zone
                     FROM watchlist_items wi JOIN instruments i ON i.id = wi.instrument_id
                     WHERE wi.watchlist_id = ?1 ORDER BY i.display_symbol",
                )?;
                let items = item_stmt
                    .query_map(params![watchlist_id], |item_row| {
                        Ok(json!({
                            "id": item_row.get::<_, String>(0)?,
                            "watchlistId": item_row.get::<_, String>(1)?,
                            "instrumentId": item_row.get::<_, String>(2)?,
                            "symbol": item_row.get::<_, String>(3)?,
                            "triggerNote": redact_secrets(&item_row.get::<_, String>(4)?),
                            "targetZone": redact_secrets(&item_row.get::<_, String>(5)?),
                        }))
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(json!({
                    "id": watchlist_id,
                    "profileId": row.get::<_, String>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "items": items,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let dir = paths.root.join("local-tools");
        fs::create_dir_all(&dir)?;
        fs::write(
            dir.join("portfolio-state.json"),
            serde_json::to_vec_pretty(&json!({
                "profileId": profile_id,
                "portfolios": portfolios,
                "watchlists": watchlists,
                "exportedAt": now(),
            }))?,
        )?;
        Ok(())
    }

    fn record_memory_activity(
        &self,
        memory_id: Option<&str>,
        event_type: &str,
        payload: Value,
    ) -> Result<()> {
        self.db.conn.execute(
            "INSERT INTO memory_activity(id, memory_id, event_type, actor, research_run_id, audit_ref, payload, created_at)
             VALUES (?1, ?2, ?3, 'user', NULL, NULL, ?4, ?5)",
            params![new_id(), memory_id, event_type, payload.to_string(), now()],
        )?;
        Ok(())
    }

    fn load_memory(&self, memory_id: &str) -> Result<Value> {
        self.db.conn.query_row(
            "SELECT id, profile_id, mem0_id, kind, summary, tags, status, updated_at FROM memory_records WHERE id = ?1",
            params![memory_id],
            |row| {
                let tags: String = row.get(5)?;
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "profileId": row.get::<_, String>(1)?,
                    "mem0Id": row.get::<_, Option<String>>(2)?,
                    "kind": row.get::<_, String>(3)?,
                    "summary": row.get::<_, String>(4)?,
                    "tags": serde_json::from_str::<Value>(&tags).unwrap_or_else(|_| json!([])),
                    "status": row.get::<_, String>(6)?,
                    "updatedAt": row.get::<_, String>(7)?,
                }))
            },
        ).optional()?.context("memory not found")
    }

    fn load_memory_for_profile(&self, memory_id: &str, profile_id: &str) -> Result<Value> {
        let memory = self.load_memory(memory_id)?;
        if memory.get("profileId").and_then(|value| value.as_str()) != Some(profile_id) {
            bail!("memory outside active profile");
        }
        Ok(memory)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionInput {
    pub profile_id: String,
    pub portfolio_id: String,
    pub account_id: Option<String>,
    pub symbol: String,
    pub quantity: f64,
    pub average_cost: f64,
    pub cost_currency: Option<String>,
    pub thesis: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePositionInput {
    pub profile_id: String,
    pub position_id: String,
    pub quantity: Option<f64>,
    pub thesis: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWatchlistInput {
    pub profile_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchlistItemInput {
    pub profile_id: String,
    pub watchlist_id: String,
    pub symbol: String,
    pub trigger_note: Option<String>,
    pub target_zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWatchlistItemInput {
    pub profile_id: String,
    pub item_id: String,
    pub trigger_note: Option<String>,
    pub target_zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairRemoteDeviceInput {
    pub profile_id: String,
    pub device_name: String,
    pub device_platform: String,
    pub public_key: String,
    pub allowed_groups: Vec<String>,
}

fn validate_final_output(structured: &mut Value) -> Result<()> {
    *structured = redact_secret_values(structured);
    let allowed = [
        "observe",
        "research_more",
        "rebalance_candidate",
        "strategy_candidate",
        "risk_warning",
        "no_action",
    ];
    let category = structured
        .get("recommendationCategory")
        .and_then(|value| value.as_str())
        .context("recommendationCategory is required")?;
    if !allowed.contains(&category) {
        bail!("invalid recommendation category: {category}");
    }
    require_non_empty_string(structured, "title")?;
    require_non_empty_string(structured, "userRequest")?;
    require_non_empty_string(structured, "selectedTeam")?;
    require_non_empty_string(structured, "summary")?;
    let confidence = structured
        .get("confidence")
        .and_then(|value| value.as_str())
        .context("confidence is required")?;
    if !["low", "medium", "high"].contains(&confidence) {
        bail!("invalid confidence: {confidence}");
    }
    require_string_array(structured, "warnings", false)?;
    require_string_array(structured, "evidenceRefs", true)?;
    require_supporting_evidence(structured)?;
    require_string_array(structured, "caveats", false)?;
    require_string_array(structured, "assumptions", false)?;
    require_string_array(structured, "dissentingViews", false)?;
    require_risk_checklist(structured)?;
    require_artifacts(structured)?;
    require_string_array(structured, "artifactRefs", false)?;
    require_string_array(structured, "limitations", false)?;
    require_string_array(structured, "nextActions", false)?;
    require_bool(structured, "approvalRequired")?;
    let risk_validation = structured
        .get("riskValidation")
        .and_then(|value| value.as_str())
        .context("riskValidation is required")?;
    if !["approved", "approved_with_warnings", "vetoed"].contains(&risk_validation) {
        bail!("invalid riskValidation: {risk_validation}");
    }
    let delay_status = structured
        .get("freshness")
        .and_then(|value| value.get("delayStatus"))
        .and_then(|value| value.as_str())
        .context("freshness.delayStatus is required")?;
    if !["realtime", "delayed", "stale", "unknown"].contains(&delay_status) {
        bail!("invalid freshness.delayStatus: {delay_status}");
    }
    if structured
        .get("riskValidation")
        .and_then(|value| value.as_str())
        == Some("vetoed")
    {
        structured["recommendationCategory"] = Value::String("no_action".to_string());
    }
    if let Some(veto) = structured.get("riskVeto") {
        let category = if veto.get("blocking").and_then(|value| value.as_bool()) == Some(false) {
            "risk_warning"
        } else {
            "no_action"
        };
        structured["recommendationCategory"] = Value::String(category.to_string());
    }
    Ok(())
}

fn require_non_empty_string(structured: &Value, key: &str) -> Result<()> {
    if structured
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        Ok(())
    } else {
        bail!("final output {key} is required")
    }
}

fn require_bool(structured: &Value, key: &str) -> Result<()> {
    if structured
        .get(key)
        .and_then(|value| value.as_bool())
        .is_some()
    {
        Ok(())
    } else {
        bail!("final output {key} is required")
    }
}

fn require_string_array(structured: &Value, key: &str, non_empty: bool) -> Result<()> {
    let values = structured
        .get(key)
        .and_then(|value| value.as_array())
        .with_context(|| format!("final output {key} must be an array"))?;
    if non_empty && values.is_empty() {
        bail!("final output {key} must not be empty");
    }
    for value in values {
        if value.as_str().is_none() {
            bail!("final output {key} must contain string values");
        }
    }
    Ok(())
}

fn require_supporting_evidence(structured: &Value) -> Result<()> {
    let values = structured
        .get("supportingEvidence")
        .and_then(|value| value.as_array())
        .context("final output supportingEvidence must be an array")?;
    if values.is_empty() {
        bail!("final output supportingEvidence must not be empty");
    }
    for value in values {
        require_nested_string(value, "supportingEvidence", "label")?;
        require_nested_string(value, "supportingEvidence", "sourceRef")?;
    }
    Ok(())
}

fn require_risk_checklist(structured: &Value) -> Result<()> {
    let values = structured
        .get("riskChecklist")
        .and_then(|value| value.as_array())
        .context("final output riskChecklist must be an array")?;
    for value in values {
        require_nested_string(value, "riskChecklist", "check")?;
        let status = value
            .get("status")
            .and_then(|value| value.as_str())
            .context("final output riskChecklist.status is required")?;
        if !["pass", "warning", "fail", "not_applicable"].contains(&status) {
            bail!("invalid riskChecklist.status: {status}");
        }
        require_nested_string_array(value, "riskChecklist", "evidenceRefs")?;
    }
    Ok(())
}

fn require_artifacts(structured: &Value) -> Result<()> {
    let values = structured
        .get("artifacts")
        .and_then(|value| value.as_array())
        .context("final output artifacts must be an array")?;
    for value in values {
        require_nested_string(value, "artifacts", "artifactId")?;
        require_nested_string(value, "artifacts", "type")?;
        require_nested_string(value, "artifacts", "title")?;
        if value.get("path").is_some() {
            require_nested_string(value, "artifacts", "path")?;
        }
    }
    Ok(())
}

fn artifact_path_for_ref(structured: &Value, artifact_ref: &str) -> Option<String> {
    structured
        .get("artifacts")
        .and_then(|value| value.as_array())?
        .iter()
        .find(|artifact| {
            ["artifactId", "title", "path"].iter().any(|field| {
                artifact.get(field).and_then(|value| value.as_str()) == Some(artifact_ref)
            })
        })
        .and_then(|artifact| artifact.get("path").and_then(|value| value.as_str()))
        .map(ToString::to_string)
}

fn require_nested_string(value: &Value, array_key: &str, field: &str) -> Result<()> {
    if value
        .get(field)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        Ok(())
    } else {
        bail!("final output {array_key}.{field} is required")
    }
}

fn require_nested_string_array(value: &Value, array_key: &str, field: &str) -> Result<()> {
    let values = value
        .get(field)
        .and_then(|value| value.as_array())
        .with_context(|| format!("final output {array_key}.{field} must be an array"))?;
    for item in values {
        if item.as_str().is_none() {
            bail!("final output {array_key}.{field} must contain string values");
        }
    }
    Ok(())
}

pub struct AppState {
    db: Mutex<PlutusDatabase>,
    paths: AppDataPaths,
}

impl AppState {
    pub fn new(db: PlutusDatabase, paths: AppDataPaths) -> Self {
        Self {
            db: Mutex::new(db),
            paths,
        }
    }

    fn with_commands<T>(&self, f: impl FnOnce(PlutusCommands<'_>) -> Result<T>) -> Result<T> {
        let db = self
            .db
            .lock()
            .map_err(|_| anyhow::anyhow!("database lock poisoned"))?;
        f(PlutusCommands::new_with_paths(&db, &self.paths))
    }

    fn with_db<T>(&self, f: impl FnOnce(&PlutusDatabase, &AppDataPaths) -> Result<T>) -> Result<T> {
        let db = self
            .db
            .lock()
            .map_err(|_| anyhow::anyhow!("database lock poisoned"))?;
        f(&db, &self.paths)
    }
}

fn command_result<T>(result: Result<T>) -> std::result::Result<T, String> {
    result.map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_app_snapshot(
    state: tauri::State<'_, AppState>,
    profile_id: Option<String>,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| {
        commands.get_app_snapshot(profile_id.as_deref().unwrap_or(MVP_PROFILE_ID))
    }))
}

#[tauri::command]
pub fn list_portfolios(
    state: tauri::State<'_, AppState>,
    profile_id: Option<String>,
) -> std::result::Result<Vec<Portfolio>, String> {
    command_result(state.with_commands(|commands| {
        commands.list_portfolios(profile_id.as_deref().unwrap_or(MVP_PROFILE_ID))
    }))
}

#[tauri::command]
pub fn create_portfolio(
    state: tauri::State<'_, AppState>,
    input: CreatePortfolioInput,
) -> std::result::Result<Portfolio, String> {
    command_result(state.with_commands(|commands| commands.create_portfolio(input)))
}

#[tauri::command]
pub fn get_portfolio_snapshot(
    state: tauri::State<'_, AppState>,
    portfolio_id: String,
    profile_id: Option<String>,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| {
        commands.get_portfolio_snapshot_for_profile(
            &portfolio_id,
            profile_id.as_deref().unwrap_or(MVP_PROFILE_ID),
        )
    }))
}

#[tauri::command]
pub fn add_portfolio_position(
    state: tauri::State<'_, AppState>,
    input: PositionInput,
) -> std::result::Result<Position, String> {
    command_result(state.with_commands(|commands| commands.add_portfolio_position(input)))
}

#[tauri::command]
pub fn update_portfolio_position(
    state: tauri::State<'_, AppState>,
    input: UpdatePositionInput,
) -> std::result::Result<Position, String> {
    command_result(state.with_commands(|commands| commands.update_portfolio_position(input)))
}

#[tauri::command]
pub fn update_position_thesis(
    state: tauri::State<'_, AppState>,
    position_id: String,
    thesis: String,
    profile_id: Option<String>,
) -> std::result::Result<Position, String> {
    command_result(state.with_commands(|commands| {
        commands.update_portfolio_position(UpdatePositionInput {
            profile_id: profile_id.context("profileId is required")?,
            position_id,
            quantity: None,
            thesis: Some(thesis),
        })
    }))
}

#[tauri::command]
pub fn list_watchlists(
    state: tauri::State<'_, AppState>,
    profile_id: Option<String>,
) -> std::result::Result<Vec<Watchlist>, String> {
    command_result(state.with_commands(|commands| {
        commands.list_watchlists(profile_id.as_deref().unwrap_or(MVP_PROFILE_ID))
    }))
}

#[tauri::command]
pub fn create_watchlist(
    state: tauri::State<'_, AppState>,
    input: CreateWatchlistInput,
) -> std::result::Result<Watchlist, String> {
    command_result(state.with_commands(|commands| commands.create_watchlist(input)))
}

#[tauri::command]
pub fn add_watchlist_item(
    state: tauri::State<'_, AppState>,
    input: WatchlistItemInput,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| commands.add_watchlist_item(input)))
}

#[tauri::command]
pub fn update_watchlist_item(
    state: tauri::State<'_, AppState>,
    input: UpdateWatchlistItemInput,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| commands.update_watchlist_item(input)))
}

#[tauri::command]
pub fn start_research_run(
    state: tauri::State<'_, AppState>,
    input: StartResearchRunInput,
) -> std::result::Result<ResearchRun, String> {
    command_result(state.with_commands(|commands| commands.start_research_run(input)))
}

#[tauri::command]
pub fn get_research_run(
    state: tauri::State<'_, AppState>,
    run_id: String,
    profile_id: Option<String>,
) -> std::result::Result<ResearchRun, String> {
    command_result(state.with_commands(|commands| {
        commands
            .get_research_run_for_profile(&run_id, profile_id.as_deref().unwrap_or(MVP_PROFILE_ID))
    }))
}

#[tauri::command]
pub fn cancel_research_run(
    state: tauri::State<'_, AppState>,
    run_id: String,
    profile_id: Option<String>,
) -> std::result::Result<(), String> {
    command_result(state.with_commands(|commands| {
        commands.cancel_research_run(&run_id, profile_id.as_deref().unwrap_or(MVP_PROFILE_ID))
    }))
}

#[tauri::command]
pub fn append_run_event(
    state: tauri::State<'_, AppState>,
    input: AppendRunEvent,
) -> std::result::Result<RunEvent, String> {
    command_result(state.with_db(|db, _paths| db.append_run_event(input)))
}

#[tauri::command]
pub fn persist_final_output(
    state: tauri::State<'_, AppState>,
    input: PersistFinalOutput,
) -> std::result::Result<FinalOutput, String> {
    command_result(state.with_commands(|commands| commands.persist_validated_final_output(input)))
}

#[tauri::command]
pub fn enqueue_local_job(
    state: tauri::State<'_, AppState>,
    input: EnqueueLocalJob,
) -> std::result::Result<LocalJob, String> {
    command_result(state.with_db(|db, _paths| db.enqueue_local_job(input)))
}

#[tauri::command]
pub fn write_artifact_file(
    state: tauri::State<'_, AppState>,
    input: WriteArtifactFile,
) -> std::result::Result<Artifact, String> {
    command_result(state.with_db(|db, paths| {
        let artifact = db.write_artifact_file(paths, input)?;
        record_audit_event(
            db,
            None,
            Some(&artifact.research_run_id),
            "agent",
            "artifact.write_file",
            &artifact.id,
            &json!({"storageKey": artifact.storage_key, "contentHash": artifact.content_hash}),
        )?;
        Ok(artifact)
    }))
}

#[tauri::command]
pub fn get_artifact(
    state: tauri::State<'_, AppState>,
    artifact_id: String,
    profile_id: Option<String>,
    run_id: Option<String>,
) -> std::result::Result<Artifact, String> {
    command_result(state.with_commands(|commands| {
        commands.get_artifact_for_profile_and_run(
            &artifact_id,
            profile_id.as_deref().unwrap_or(MVP_PROFILE_ID),
            run_id.as_deref(),
        )
    }))
}

#[tauri::command]
pub fn open_local_artifact_file(
    state: tauri::State<'_, AppState>,
    artifact_id: String,
    profile_id: Option<String>,
    run_id: Option<String>,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| {
        commands.open_local_artifact_file_for_profile(
            &artifact_id,
            profile_id.as_deref().unwrap_or(MVP_PROFILE_ID),
            run_id.as_deref(),
        )
    }))
}

#[tauri::command]
pub fn list_memory_activity(
    state: tauri::State<'_, AppState>,
    profile_id: Option<String>,
    limit: Option<i64>,
) -> std::result::Result<Vec<Value>, String> {
    command_result(state.with_commands(|commands| {
        commands.list_memory_activity(
            profile_id.as_deref().unwrap_or(MVP_PROFILE_ID),
            limit.unwrap_or(50),
        )
    }))
}

#[tauri::command]
pub fn update_memory(
    state: tauri::State<'_, AppState>,
    memory_id: String,
    profile_id: Option<String>,
    patch: Value,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| {
        commands.update_memory(
            &memory_id,
            profile_id.as_deref().unwrap_or(MVP_PROFILE_ID),
            patch,
        )
    }))
}

#[tauri::command]
pub fn archive_memory(
    state: tauri::State<'_, AppState>,
    memory_id: String,
    profile_id: Option<String>,
    reason: String,
) -> std::result::Result<(), String> {
    command_result(state.with_commands(|commands| {
        commands.archive_memory(
            &memory_id,
            profile_id.as_deref().unwrap_or(MVP_PROFILE_ID),
            &reason,
        )
    }))
}

#[tauri::command]
pub fn forget_memory(
    state: tauri::State<'_, AppState>,
    memory_id: String,
    profile_id: Option<String>,
) -> std::result::Result<(), String> {
    command_result(state.with_commands(|commands| {
        commands.forget_memory(&memory_id, profile_id.as_deref().unwrap_or(MVP_PROFILE_ID))
    }))
}

#[tauri::command]
pub fn set_memory_category_enabled(
    state: tauri::State<'_, AppState>,
    category: String,
    enabled: bool,
) -> std::result::Result<(), String> {
    command_result(
        state.with_commands(|commands| commands.set_memory_category_enabled(&category, enabled)),
    )
}

#[tauri::command]
pub fn list_wiki_pages(
    state: tauri::State<'_, AppState>,
    profile_id: Option<String>,
    limit: Option<i64>,
) -> std::result::Result<Vec<Value>, String> {
    command_result(state.with_commands(|commands| {
        commands.list_wiki_pages(
            profile_id.as_deref().unwrap_or(MVP_PROFILE_ID),
            limit.unwrap_or(50),
        )
    }))
}

#[tauri::command]
pub fn get_wiki_page(
    state: tauri::State<'_, AppState>,
    page_id: String,
    profile_id: Option<String>,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| {
        commands.get_wiki_page(&page_id, profile_id.as_deref().unwrap_or(MVP_PROFILE_ID))
    }))
}

#[tauri::command]
pub fn list_wiki_activity(
    state: tauri::State<'_, AppState>,
    profile_id: Option<String>,
    limit: Option<i64>,
) -> std::result::Result<Vec<Value>, String> {
    command_result(state.with_commands(|commands| {
        commands.list_wiki_activity(
            profile_id.as_deref().unwrap_or(MVP_PROFILE_ID),
            limit.unwrap_or(50),
        )
    }))
}

#[tauri::command]
pub fn revert_wiki_revision(
    state: tauri::State<'_, AppState>,
    page_id: String,
    revision_id: String,
    reason: String,
) -> std::result::Result<Value, String> {
    command_result(
        state.with_commands(|commands| {
            commands.revert_wiki_revision(&page_id, &revision_id, &reason)
        }),
    )
}

#[tauri::command]
pub fn pair_remote_device(
    state: tauri::State<'_, AppState>,
    input: PairRemoteDeviceInput,
) -> std::result::Result<RemoteSession, String> {
    command_result(state.with_db(|db, paths| {
        let groups = input
            .allowed_groups
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>();
        let session = pair_device(
            db,
            &input.profile_id,
            &input.device_name,
            &input.device_platform,
            &input.public_key,
            &groups,
        )?;
        let key_ref = SecureStore::create_remote_session_key(&paths.secure_storage, &session.id)?;
        SecureStore::assert_secure_ref(&key_ref)?;
        Ok(session)
    }))
}

#[tauri::command]
pub fn revoke_remote_device(
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> std::result::Result<(), String> {
    command_result(state.with_db(|db, _paths| {
        revoke_device(db, &device_id)?;
        record_audit_event(
            db,
            None,
            None,
            "user",
            "remote.device_revoked",
            &device_id,
            &json!({"deviceId": device_id}),
        )?;
        Ok(())
    }))
}

#[tauri::command]
pub fn list_remote_devices(
    state: tauri::State<'_, AppState>,
    profile_id: Option<String>,
) -> std::result::Result<Vec<RemoteDevice>, String> {
    command_result(
        state.with_db(|db, _paths| {
            list_devices(db, profile_id.as_deref().unwrap_or(MVP_PROFILE_ID))
        }),
    )
}

#[tauri::command]
pub fn execute_remote_command(
    state: tauri::State<'_, AppState>,
    request: RemoteCommandRequest,
) -> std::result::Result<RemoteCommandExecutionResponse, String> {
    command_result(
        state.with_db(|db, paths| execute_authorized_remote_command(db, Some(paths), &request)),
    )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareRemoteUnlockInput {
    pub command_id: String,
    pub command_type: String,
    pub payload: Value,
}

#[tauri::command]
pub fn prepare_remote_unlock(
    _input: PrepareRemoteUnlockInput,
) -> std::result::Result<Value, String> {
    Err("remote biometric unlock must be prepared by the paired device runtime".to_string())
}

pub fn seed_run_artifact(db: &PlutusDatabase, run_id: &str) -> Result<String> {
    let artifact_id = new_id();
    db.conn.execute(
        "INSERT INTO agent_artifacts(id, research_run_id, artifact_type, title, storage_key, content_hash, mime_type, metadata, created_by_agent, created_at)
         VALUES (?1, ?2, 'run_card', 'BTC/NVDA Run Card', ?3, ?4, 'application/json', '{}', 'report_writer', ?5)",
        params![artifact_id, run_id, format!("artifacts/{artifact_id}.json"), "sha256-fixture", now()],
    )?;
    Ok(artifact_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::{PlutusDatabase, MVP_BTC_ID, MVP_PORTFOLIO_ID, MVP_WATCHLIST_ID};

    fn valid_final_card(summary: &str, category: &str) -> Value {
        json!({
            "title": summary,
            "recommendationCategory": category,
            "userRequest": "Review BTC/NVDA exposure and identify risk inspection steps.",
            "selectedTeam": "portfolio_review_committee",
            "riskValidation": "approved_with_warnings",
            "summary": summary,
            "confidence": "medium",
            "warnings": ["Review concentration risk before acting."],
            "evidenceRefs": ["portfolio:core"],
            "supportingEvidence": [
                {"label": "Core portfolio", "sourceRef": "portfolio:core"}
            ],
            "freshness": {"delayStatus": "delayed"},
            "caveats": ["Not investment advice."],
            "assumptions": ["Portfolio data is current enough for review."],
            "dissentingViews": ["No dissenting view recorded."],
            "riskChecklist": [
                {"check": "Concentration", "status": "warning", "evidenceRefs": ["portfolio:core"]}
            ],
            "artifacts": [],
            "artifactRefs": [],
            "limitations": ["Read-only review; no trade execution authorized."],
            "nextActions": ["Refresh stale quote inputs before action."],
            "approvalRequired": true
        })
    }

    #[test]
    fn command_layer_persists_portfolios_runs_and_artifacts() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let commands = PlutusCommands::new(&db);
        let portfolio = commands
            .create_portfolio(CreatePortfolioInput {
                profile_id: MVP_PROFILE_ID.to_string(),
                name: "Command Portfolio".to_string(),
                base_currency: "USD".to_string(),
            })
            .unwrap();
        assert_eq!(portfolio.name, "Command Portfolio");

        let run = commands
            .start_research_run(StartResearchRunInput {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA with api_key sk-secret".to_string(),
                selected_team: None,
            })
            .unwrap();
        assert!(!run.user_request.contains("sk-secret"));
        let artifact_id = seed_run_artifact(&db, &run.id).unwrap();
        assert_eq!(
            commands.get_artifact(&artifact_id).unwrap().artifact_type,
            "run_card"
        );
        commands
            .cancel_research_run(&run.id, MVP_PROFILE_ID)
            .unwrap();
        assert_eq!(
            commands.get_research_run(&run.id).unwrap().status,
            "completed"
        );
    }

    #[test]
    fn start_run_persists_resumable_runtime_bridge_metadata_and_event() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::open(&paths.database).unwrap();
        db.seed_mvp().unwrap();
        let commands = PlutusCommands::new_with_paths(&db, &paths);

        let run = commands
            .start_research_run(StartResearchRunInput {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA".to_string(),
                selected_team: None,
            })
            .unwrap();

        assert!(run
            .codex_thread_id
            .as_deref()
            .unwrap()
            .starts_with("codex-thread-"));
        assert_eq!(
            run.workspace_path,
            paths.run_workspaces.join(&run.id).display().to_string()
        );
        assert!(paths.run_workspaces.join(&run.id).exists());
        let (config_hash, model_config): (String, String) = db
            .conn
            .query_row(
                "SELECT local_tool_config_hash, model_config FROM research_runs WHERE id = ?1",
                [&run.id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(config_hash.len(), 64);
        assert!(model_config.contains("codex_sdk_run_host"));
        let event_type: String = db
            .conn
            .query_row(
                "SELECT event_type FROM research_run_events WHERE research_run_id = ?1 AND sequence = 1",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(event_type, "codex_run_host.started");
        assert!(paths.root.join("local-tools/portfolio-state.json").exists());
        let memory_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM memory_records WHERE kind = 'risk_warning' AND source_refs LIKE ?1",
                [format!("%{}%", run.id)],
                |row| row.get(0),
            )
            .unwrap();
        assert!(memory_count > 0);
        let wiki_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM wiki_pages WHERE title = 'BTC/NVDA risk review'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(wiki_count > 0);
    }

    #[test]
    fn cancel_run_is_scoped_to_active_profile() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let timestamp = now();
        let other_profile_id = "018f3f5d-0000-7000-8000-444444444444";
        db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile_id, timestamp],
            )
            .unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: other_profile_id.to_string(),
                portfolio_id: None,
                user_request: "Other profile review".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        let commands = PlutusCommands::new(&db);

        let rejected = commands.cancel_research_run(&run.id, MVP_PROFILE_ID);
        assert!(rejected
            .unwrap_err()
            .to_string()
            .contains("outside active profile"));
        assert_eq!(commands.get_research_run(&run.id).unwrap().status, "queued");
    }

    #[test]
    fn memory_delete_and_wiki_revert_follow_domain_lifecycle_semantics() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let commands = PlutusCommands::new(&db);
        let timestamp = now();
        let memory_id = new_id();
        db.conn
            .execute(
                "INSERT INTO memory_records(id, profile_id, mem0_id, kind, summary, tags, source_refs, capture_policy, sensitivity_class, retention_class, status, created_at, updated_at)
                 VALUES (?1, ?2, NULL, 'research_memory', 'Deletion test memory', '[]', '[]', 'manual', 'normal', 'default', 'active', ?3, ?3)",
                params![memory_id, MVP_PROFILE_ID, timestamp],
            )
            .unwrap();
        commands
            .archive_memory(&memory_id, MVP_PROFILE_ID, "old lesson")
            .unwrap();
        let (archived_status, archived_retention): (String, String) = db
            .conn
            .query_row(
                "SELECT status, retention_class FROM memory_records WHERE id = ?1",
                params![memory_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(archived_status, "archived");
        assert_eq!(archived_retention, "archived");
        commands.forget_memory(&memory_id, MVP_PROFILE_ID).unwrap();
        let (deleted_status, deleted_at): (String, Option<String>) = db
            .conn
            .query_row(
                "SELECT status, deleted_at FROM memory_records WHERE id = ?1",
                params![memory_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(deleted_status, "deleted");
        assert!(deleted_at.is_some());

        let other_profile_id = "018f3f5d-0000-7000-8000-555555555555";
        db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile_id, timestamp],
            )
            .unwrap();
        let other_memory_id = new_id();
        db.conn
            .execute(
                "INSERT INTO memory_records(id, profile_id, mem0_id, kind, summary, tags, source_refs, capture_policy, sensitivity_class, retention_class, status, created_at, updated_at)
                 VALUES (?1, ?2, NULL, 'research_memory', 'Other profile memory', '[]', '[]', 'manual', 'normal', 'default', 'active', ?3, ?3)",
                params![other_memory_id, other_profile_id, timestamp],
            )
            .unwrap();
        assert!(commands
            .archive_memory(&other_memory_id, MVP_PROFILE_ID, "wrong profile")
            .unwrap_err()
            .to_string()
            .contains("memory outside active profile"));

        let wiki_id = new_id();
        let original_revision_id = new_id();
        let current_revision_id = new_id();
        db.conn
            .execute(
                "INSERT INTO wiki_pages(id, profile_id, slug, category, title, summary, status, current_revision_id, tags, source_refs, memory_refs, freshness, confidence, created_at, updated_at)
                 VALUES (?1, ?2, 'revert-risk', 'risk_lesson', 'Revert Risk', 'Risk note', 'active', ?3, '[]', '[]', '[]', 'current', 'medium', ?4, ?4)",
                params![wiki_id, MVP_PROFILE_ID, current_revision_id, timestamp],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
                 VALUES (?1, ?2, 1, 'wiki/revert-v1.md', 'hash-v1', 'Original', '[]', '[]', 'agent:llm_wiki_curator', NULL, ?3)",
                params![original_revision_id, wiki_id, timestamp],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
                 VALUES (?1, ?2, 2, 'wiki/revert-v2.md', 'hash-v2', 'Update', '[]', '[]', 'agent:llm_wiki_curator', NULL, ?3)",
                params![current_revision_id, wiki_id, timestamp],
            )
            .unwrap();

        let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
        let snapshot_page = snapshot["wikiPages"]
            .as_array()
            .unwrap()
            .iter()
            .find(|page| page["id"].as_str() == Some(wiki_id.as_str()))
            .unwrap();
        assert_eq!(snapshot_page["revisionNote"].as_str(), Some("Update"));

        let page = commands
            .revert_wiki_revision(&wiki_id, &original_revision_id, "restore vetted text")
            .unwrap();
        assert_ne!(page["currentRevisionId"], original_revision_id);
        let (revision_number, content_hash, note): (i64, String, String) = db
            .conn
            .query_row(
                "SELECT revision_number, content_hash, revision_note FROM wiki_revisions WHERE id = ?1",
                params![page["currentRevisionId"].as_str().unwrap()],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(revision_number, 3);
        assert_eq!(content_hash, "hash-v1");
        assert_eq!(note, "Revert: restore vetted text");
    }

    #[test]
    fn final_output_validation_blocks_invalid_categories_and_risk_vetoes_to_no_action() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        let commands = PlutusCommands::new(&db);

        let invalid = commands.persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Bad category".to_string(),
            structured_output: {
                let mut card = valid_final_card("Bad category", "risk_warning");
                card["recommendationCategory"] = json!("rebalance");
                card
            },
        });
        assert!(invalid
            .unwrap_err()
            .to_string()
            .contains("invalid recommendation category"));

        let output = commands
            .persist_validated_final_output(PersistFinalOutput {
                research_run_id: run.id.clone(),
                summary: "Risk veto blocks action".to_string(),
                structured_output: {
                    let mut card =
                        valid_final_card("Risk veto blocks action", "strategy_candidate");
                    card["riskValidation"] = json!("vetoed");
                    card["riskVeto"] = json!({"reason": "Concentration breach"});
                    card["freshness"] = json!({"delayStatus": "realtime"});
                    card
                },
            })
            .unwrap();

        assert_eq!(
            output.structured_output["recommendationCategory"],
            "no_action"
        );
        assert_eq!(
            commands
                .get_research_run(&run.id)
                .unwrap()
                .recommendation_category,
            Some("no_action".to_string())
        );
        let audit_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM audit_events WHERE research_run_id = ?1 AND action = 'research_run.final_output'",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(audit_count, 1);
        let artifact_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM agent_artifacts WHERE research_run_id = ?1",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(artifact_count, 0);
        let memory_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM memory_records WHERE profile_id = ?1",
                [MVP_PROFILE_ID],
                |row| row.get(0),
            )
            .unwrap();
        let wiki_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM wiki_pages WHERE profile_id = ?1",
                [MVP_PROFILE_ID],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(memory_count, 1);
        assert_eq!(wiki_count, 1);
    }

    #[test]
    fn final_output_rejects_missing_artifact_refs() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        let commands = PlutusCommands::new(&db);

        let missing = commands.persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Missing artifact".to_string(),
            structured_output: {
                let mut card = valid_final_card("Missing artifact", "risk_warning");
                card["artifactRefs"] = json!(["missing-run-card"]);
                card
            },
        });

        assert!(missing
            .unwrap_err()
            .to_string()
            .contains("final output artifactRef not found"));
        assert_ne!(
            commands.get_research_run(&run.id).unwrap().status,
            "completed"
        );
    }

    #[test]
    fn final_output_accepts_tool_artifact_refs_with_workspace_paths() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        let workspace = paths.run_workspaces.join(&run.id);
        fs::create_dir_all(workspace.join("reports")).unwrap();
        fs::write(workspace.join("reports/run-card.json"), br#"{"ok":true}"#).unwrap();
        let commands = PlutusCommands::new_with_paths(&db, &paths);

        commands
            .persist_validated_final_output(PersistFinalOutput {
                research_run_id: run.id.clone(),
                summary: "Path artifact".to_string(),
                structured_output: {
                    let mut card = valid_final_card("Path artifact", "risk_warning");
                    card["artifactRefs"] = json!(["report-json"]);
                    card["artifacts"] = json!([
                        {
                            "artifactId": "report-json",
                            "type": "run_card",
                            "title": "Report JSON",
                            "path": "reports/run-card.json"
                        }
                    ]);
                    card
                },
            })
            .unwrap();

        let artifact_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM agent_artifacts WHERE research_run_id = ?1 AND title = 'reports/run-card.json'",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(artifact_count, 1);
    }

    #[test]
    fn artifact_access_rejects_wrong_run_scope() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let run_a = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review A".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        let run_b = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review B".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        let artifact_id = seed_run_artifact(&db, &run_b.id).unwrap();
        let commands = PlutusCommands::new(&db);

        let rejected = commands.get_artifact_for_profile_and_run(
            &artifact_id,
            MVP_PROFILE_ID,
            Some(&run_a.id),
        );
        assert!(rejected
            .unwrap_err()
            .to_string()
            .contains("artifact outside requested run"));
    }

    #[test]
    fn final_output_rejects_escaping_artifact_paths_before_completion() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
        let commands = PlutusCommands::new_with_paths(&db, &paths);
        let outside = temp.path().join("outside-secret.txt");
        fs::write(&outside, "secret").unwrap();

        let rejected = commands.persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Escaping artifact".to_string(),
            structured_output: {
                let mut card = valid_final_card("Escaping artifact", "risk_warning");
                card["artifactPaths"] = json!([outside.display().to_string()]);
                card
            },
        });

        assert!(rejected
            .unwrap_err()
            .to_string()
            .contains("must be relative to run workspace"));
        assert_ne!(
            commands.get_research_run(&run.id).unwrap().status,
            "completed"
        );
    }

    #[test]
    fn final_output_rejects_non_string_artifact_refs_and_paths() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
        let commands = PlutusCommands::new_with_paths(&db, &paths);

        let bad_ref = commands.persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Bad ref".to_string(),
            structured_output: {
                let mut card = valid_final_card("Bad ref", "risk_warning");
                card["artifactRefs"] = json!([123]);
                card
            },
        });
        assert!(bad_ref
            .unwrap_err()
            .to_string()
            .contains("artifactRefs must contain string values"));

        let bad_path = commands.persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Bad path".to_string(),
            structured_output: {
                let mut card = valid_final_card("Bad path", "risk_warning");
                card["artifactPaths"] = json!([{}]);
                card
            },
        });
        assert!(bad_path
            .unwrap_err()
            .to_string()
            .contains("artifactPaths must contain string values"));
        assert_ne!(
            commands.get_research_run(&run.id).unwrap().status,
            "completed"
        );
    }

    #[test]
    fn final_output_accepts_runtime_run_card_shape_and_projects_refs_to_snapshot() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let commands = PlutusCommands::new_with_paths(&db, &paths);
        let run = commands
            .start_research_run(StartResearchRunInput {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA".to_string(),
                selected_team: None,
            })
            .unwrap();
        db.write_artifact_file(
            &paths,
            WriteArtifactFile {
                research_run_id: run.id.clone(),
                artifact_type: "run_card".to_string(),
                title: "runtime-run-card".to_string(),
                mime_type: "application/json".to_string(),
                metadata: json!({"source": "test"}),
                created_by_agent: "report_writer".to_string(),
                contents: br#"{"title":"Runtime run card"}"#.to_vec(),
            },
        )
        .unwrap();

        commands
            .persist_validated_final_output(PersistFinalOutput {
                research_run_id: run.id.clone(),
                summary: "Runtime run card".to_string(),
                structured_output: {
                    let mut card = valid_final_card("Runtime run card", "risk_warning");
                    card["category"] = json!("risk_warning");
                    card["riskValidation"] = json!("vetoed");
                    card["warnings"] = json!(["Concentration remains elevated"]);
                    card["artifactRefs"] = json!(["runtime-run-card"]);
                    card
                },
            })
            .unwrap();
        assert_eq!(
            commands
                .get_research_run(&run.id)
                .unwrap()
                .recommendation_category,
            Some("no_action".to_string())
        );

        let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
        let artifacts = snapshot["artifacts"].as_array().unwrap();
        assert!(artifacts.iter().any(|artifact| {
            artifact["researchRunId"].as_str() == Some(run.id.as_str())
                && artifact["title"].as_str() == Some("runtime-run-card")
        }));
        let artifact_path: String = db
            .conn
            .query_row(
                "SELECT storage_key FROM agent_artifacts WHERE research_run_id = ?1 AND title = 'runtime-run-card'",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(paths.root.join(artifact_path).is_file());
        assert_eq!(
            snapshot["memoryActivity"][0]["researchRunId"].as_str(),
            Some(run.id.as_str())
        );
        assert!(snapshot["memoryActivity"]
            .as_array()
            .unwrap()
            .iter()
            .any(|activity| activity["payload"]["summary"] == "Runtime run card"));
        assert!(snapshot["wikiPages"]
            .as_array()
            .unwrap()
            .iter()
            .any(|page| {
                page["title"] == "Runtime run card" && page["sourceRefs"][0] == "portfolio:core"
            }));
    }

    #[test]
    fn runtime_stream_consumer_persists_events_and_final_output_for_spawned_runs() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::open(&paths.database).unwrap();
        db.seed_mvp().unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Stream runtime output".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        db.conn
            .execute(
                "UPDATE research_runs SET status = 'running' WHERE id = ?1",
                params![run.id],
            )
            .unwrap();
        fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
        let final_card = {
            let mut card = valid_final_card("Spawned runtime card", "risk_warning");
            card["category"] = json!("risk_warning");
            card["riskValidation"] = json!("vetoed");
            card
        };
        let stream = format!(
            "{}\n{}\n{}\n",
            json!({"type": "started", "threadId": "codex-thread-real"}),
            json!({"type": "event", "event": {"type": "run.stage_started", "stage": "planning", "runId": run.id}}),
            json!({"type": "finalOutput", "finalOutput": final_card})
        );

        spawn_codex_runtime_stream_consumer(
            run.id.clone(),
            paths.clone(),
            std::io::Cursor::new(stream.into_bytes()),
            None::<std::io::Cursor<Vec<u8>>>,
            spawn_finished_child(0),
        );

        let reopened = PlutusDatabase::open(&paths.database).unwrap();
        for _ in 0..50 {
            let count: i64 = reopened
                .conn
                .query_row(
                    "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                    params![run.id],
                    |row| row.get(0),
                )
                .unwrap();
            if count == 1 {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        let (status, thread_id): (String, Option<String>) = reopened
            .conn
            .query_row(
                "SELECT status, codex_thread_id FROM research_runs WHERE id = ?1",
                params![run.id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(status, "completed");
        assert_eq!(thread_id, Some("codex-thread-real".to_string()));
        let event_count: i64 = reopened
            .conn
            .query_row(
                "SELECT COUNT(*) FROM research_run_events WHERE research_run_id = ?1 AND event_type = 'run.stage_started'",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(event_count, 1);
    }

    #[test]
    fn runtime_stream_consumer_ignores_spoofed_run_ids_inside_stream() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::open(&paths.database).unwrap();
        db.seed_mvp().unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Primary run".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        let other_run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Other run".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
        let mut final_card = valid_final_card("Spoofed stream card", "risk_warning");
        final_card["runId"] = json!(other_run.id);
        final_card["category"] = json!("risk_warning");
        final_card["riskValidation"] = json!("vetoed");
        let stream = format!(
            "{}\n{}\n",
            json!({"type": "event", "event": {"type": "run.stage_started", "stage": "planning", "runId": other_run.id}}),
            json!({"type": "finalOutput", "finalOutput": final_card})
        );
        spawn_codex_runtime_stream_consumer(
            run.id.clone(),
            paths.clone(),
            std::io::Cursor::new(stream.into_bytes()),
            None::<std::io::Cursor<Vec<u8>>>,
            spawn_finished_child(0),
        );
        let reopened = PlutusDatabase::open(&paths.database).unwrap();
        for _ in 0..50 {
            let count: i64 = reopened
                .conn
                .query_row(
                    "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                    params![run.id],
                    |row| row.get(0),
                )
                .unwrap();
            if count == 1 {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        let primary_outputs: i64 = reopened
            .conn
            .query_row(
                "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
        let other_outputs: i64 = reopened
            .conn
            .query_row(
                "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                params![other_run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(primary_outputs, 1);
        assert_eq!(other_outputs, 0);
        let structured_output: String = reopened
            .conn
            .query_row(
                "SELECT structured_output FROM research_run_final_outputs WHERE research_run_id = ?1",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
        let structured_output = serde_json::from_str::<Value>(&structured_output).unwrap();
        assert_eq!(structured_output["runId"], run.id);
        assert_eq!(structured_output["profileId"], MVP_PROFILE_ID);
        let event_payload: String = reopened
            .conn
            .query_row(
                "SELECT payload FROM research_run_events WHERE research_run_id = ?1 AND event_type = 'run.stage_started'",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
        let event_payload = serde_json::from_str::<Value>(&event_payload).unwrap();
        assert_eq!(event_payload["runId"], run.id);
        assert_eq!(event_payload["profileId"], MVP_PROFILE_ID);
    }

    #[test]
    fn runtime_stream_consumer_preserves_final_output_validation_error() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::open(&paths.database).unwrap();
        db.seed_mvp().unwrap();
        let run = db
            .create_research_run(NewResearchRun {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Invalid stream output".to_string(),
                selected_team: "portfolio_review_committee".to_string(),
            })
            .unwrap();
        db.conn
            .execute(
                "UPDATE research_runs SET status = 'running' WHERE id = ?1",
                params![run.id],
            )
            .unwrap();
        fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
        let mut final_card = valid_final_card("Invalid stream card", "risk_warning");
        final_card["recommendationCategory"] = json!("trade_now");
        let stream = format!(
            "{}\n",
            json!({"type": "finalOutput", "finalOutput": final_card})
        );
        spawn_codex_runtime_stream_consumer(
            run.id.clone(),
            paths.clone(),
            std::io::Cursor::new(stream.into_bytes()),
            None::<std::io::Cursor<Vec<u8>>>,
            spawn_finished_child(0),
        );
        let reopened = PlutusDatabase::open(&paths.database).unwrap();
        for _ in 0..50 {
            let reason: Option<String> = reopened
                .conn
                .query_row(
                    "SELECT failure_reason FROM research_runs WHERE id = ?1",
                    params![run.id],
                    |row| row.get(0),
                )
                .unwrap();
            if reason.is_some() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        let failure_reason: String = reopened
            .conn
            .query_row(
                "SELECT failure_reason FROM research_runs WHERE id = ?1",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(failure_reason.contains("invalid recommendation category"));
    }

    fn spawn_finished_child(exit_code: i32) -> std::process::Child {
        Command::new("sh")
            .arg("-c")
            .arg(format!("exit {exit_code}"))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap()
    }

    #[test]
    fn watchlist_mutations_are_scoped_to_active_profile() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let commands = PlutusCommands::new(&db);
        let timestamp = now();
        let other_profile_id = "018f3f5d-0000-7000-8000-222222222222";
        db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile_id, timestamp],
            )
            .unwrap();
        let other_watchlist = commands
            .create_watchlist(CreateWatchlistInput {
                profile_id: other_profile_id.to_string(),
                name: "Other Watchlist".to_string(),
            })
            .unwrap();

        let denied_add = commands.add_watchlist_item(WatchlistItemInput {
            profile_id: MVP_PROFILE_ID.to_string(),
            watchlist_id: other_watchlist.id.clone(),
            symbol: "BTC-USD".to_string(),
            trigger_note: None,
            target_zone: None,
        });
        assert!(denied_add
            .unwrap_err()
            .to_string()
            .contains("watchlist outside active profile"));

        let other_item = commands
            .add_watchlist_item(WatchlistItemInput {
                profile_id: other_profile_id.to_string(),
                watchlist_id: other_watchlist.id,
                symbol: "BTC-USD".to_string(),
                trigger_note: None,
                target_zone: None,
            })
            .unwrap();
        let denied_update = commands.update_watchlist_item(UpdateWatchlistItemInput {
            profile_id: MVP_PROFILE_ID.to_string(),
            item_id: other_item["id"].as_str().unwrap().to_string(),
            trigger_note: Some("cross-profile edit".to_string()),
            target_zone: None,
        });
        assert!(denied_update
            .unwrap_err()
            .to_string()
            .contains("watchlist item outside active profile"));
    }

    #[test]
    fn portfolio_mutations_and_runs_are_scoped_to_active_profile() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let commands = PlutusCommands::new(&db);
        let timestamp = now();
        let other_profile_id = "018f3f5d-0000-7000-8000-333333333333";
        db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile_id, timestamp],
            )
            .unwrap();
        let other_portfolio = commands
            .create_portfolio(CreatePortfolioInput {
                profile_id: other_profile_id.to_string(),
                name: "Other Portfolio".to_string(),
                base_currency: "USD".to_string(),
            })
            .unwrap();

        let denied_run = commands.start_research_run(StartResearchRunInput {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(other_portfolio.id.clone()),
            user_request: "Review other portfolio".to_string(),
            selected_team: None,
        });
        assert!(denied_run
            .unwrap_err()
            .to_string()
            .contains("portfolio outside active profile"));

        let denied_add = commands.add_portfolio_position(PositionInput {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: other_portfolio.id.clone(),
            account_id: None,
            symbol: "BTC-USD".to_string(),
            quantity: 1.0,
            average_cost: 1.0,
            cost_currency: None,
            thesis: None,
        });
        assert!(denied_add
            .unwrap_err()
            .to_string()
            .contains("portfolio outside active profile"));

        let position_id: String = db
            .conn
            .query_row(
                "SELECT id FROM positions WHERE portfolio_id = ?1 LIMIT 1",
                [MVP_PORTFOLIO_ID],
                |row| row.get(0),
            )
            .unwrap();
        let denied_update = commands.update_portfolio_position(UpdatePositionInput {
            profile_id: other_profile_id.to_string(),
            position_id,
            quantity: Some(2.0),
            thesis: None,
        });
        assert!(denied_update
            .unwrap_err()
            .to_string()
            .contains("position outside active profile"));
    }

    #[test]
    fn command_surface_blocks_trade_tools() {
        let db = PlutusDatabase::in_memory().unwrap();
        let commands = PlutusCommands::new(&db);
        assert!(commands
            .assert_command_surface_safe("trade.place_order")
            .is_err());
        assert!(commands
            .assert_command_surface_safe("researchRuns.start")
            .is_ok());
    }

    #[test]
    fn app_snapshot_exposes_remote_session_and_requires_remote_unlock_proof() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            &crate::remote_control::test_remote_public_key(),
            &["run"],
        )
        .unwrap();
        let key_ref =
            SecureStore::create_remote_session_key(&paths.secure_storage, &session.id).unwrap();
        let commands = PlutusCommands::new_with_paths(&db, &paths);

        let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
        let remote = &snapshot["remoteDevices"][0];
        assert!(remote.get("session_id").is_none());
        assert!(remote.get("session_key_ref").is_none());
        assert!(remote.get("unlock_proof").is_none());

        let locked = execute_authorized_remote_command(
            &db,
            Some(&paths),
            &RemoteCommandRequest {
                command_id: "cmd-snapshot-run".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(key_ref.clone()),
                unlock: Some(crate::remote_control::RemoteUnlockProof {
                    method: "biometric".to_string(),
                    session_key_ref: key_ref.clone(),
                    challenge: None,
                }),
                command_type: "run.start".to_string(),
                payload: json!({"userRequest": "Remote review"}),
            },
        )
        .unwrap();
        assert!(!locked.authorization.permission_granted);
        assert!(locked
            .authorization
            .warnings
            .contains(&"unlock_required".to_string()));

        let request = RemoteCommandRequest {
            command_id: "cmd-snapshot-run".to_string(),
            session_id: session.id.clone(),
            session_key_ref: Some(key_ref.clone()),
            unlock: Some(crate::remote_control::RemoteUnlockProof {
                method: "biometric".to_string(),
                session_key_ref: key_ref,
                challenge: Some(crate::remote_control::test_unlock_challenge(
                    &session.id,
                    "cmd-snapshot-run",
                    &session.session_key_ref,
                    "run.start",
                    &json!({"userRequest": "Remote review"}),
                )),
            }),
            command_type: "run.start".to_string(),
            payload: json!({"userRequest": "Remote review"}),
        };
        let response = execute_authorized_remote_command(&db, Some(&paths), &request).unwrap();
        assert!(response.authorization.permission_granted);
    }

    #[test]
    fn app_snapshot_redacts_free_text_secret_fields() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        db.conn
            .execute(
                "UPDATE positions SET thesis = 'api_key sk-testvalue visible thesis' WHERE instrument_id = ?1",
                params![MVP_BTC_ID],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO watchlist_items(id, watchlist_id, instrument_id, trigger_note, target_zone, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 'password=secret watch', 'broker token zone', ?4, ?4)",
                params![new_id(), MVP_WATCHLIST_ID, MVP_BTC_ID, now()],
            )
            .unwrap();
        let commands = PlutusCommands::new(&db);
        let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
        let thesis = snapshot["portfolios"][0]["positions"][0]["thesis"]
            .as_str()
            .unwrap();
        let trigger_note = snapshot["watchlists"][0]["items"][0]["triggerNote"]
            .as_str()
            .unwrap();
        let target_zone = snapshot["watchlists"][0]["items"][0]["targetZone"]
            .as_str()
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO wiki_pages(id, profile_id, slug, category, title, summary, status, current_revision_id, tags, source_refs, memory_refs, freshness, confidence, created_at, updated_at)
                 VALUES (?1, ?2, 'secret-wiki', 'research', 'api_key wiki', 'broker token summary', 'active', NULL, '[]', ?3, '[]', 'fresh', 'medium', ?4, ?4)",
                params![
                    new_id(),
                    MVP_PROFILE_ID,
                    json!(["password=source"]).to_string(),
                    now()
                ],
            )
            .unwrap();
        let temp = tempfile::tempdir().unwrap();
        let paths = AppDataPaths::create(temp.path()).unwrap();
        let mut file_db = PlutusDatabase::open(&paths.database).unwrap();
        file_db.seed_mvp().unwrap();
        file_db
            .conn
            .execute(
                "UPDATE positions SET thesis = 'api_key sk-testvalue visible thesis' WHERE instrument_id = ?1",
                params![MVP_BTC_ID],
            )
            .unwrap();
        file_db
            .conn
            .execute(
                "INSERT INTO watchlist_items(id, watchlist_id, instrument_id, trigger_note, target_zone, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 'password=secret watch', 'broker token zone', ?4, ?4)",
                params![new_id(), MVP_WATCHLIST_ID, MVP_BTC_ID, now()],
            )
            .unwrap();
        let file_commands = PlutusCommands::new_with_paths(&file_db, &paths);
        file_commands
            .export_local_tool_portfolio_state(MVP_PROFILE_ID)
            .unwrap();
        let exported =
            fs::read_to_string(paths.root.join("local-tools/portfolio-state.json")).unwrap();
        assert!(thesis.contains("[REDACTED]"));
        assert!(trigger_note.contains("[REDACTED]"));
        assert!(target_zone.contains("[REDACTED]"));
        let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
        let wiki_pages = snapshot["wikiPages"].as_array().unwrap();
        let secret_wiki = wiki_pages
            .iter()
            .find(|page| page["slug"].as_str() == Some("secret-wiki"))
            .unwrap();
        let secret_wiki_text = secret_wiki.to_string();
        assert!(secret_wiki_text.contains("[REDACTED]"));
        assert!(!secret_wiki_text.contains("api_key"));
        assert!(!secret_wiki_text.contains("broker token"));
        assert!(!secret_wiki_text.contains("password=source"));
        assert!(exported.contains("[REDACTED]"));
        assert!(!exported.contains("sk-testvalue"));
        assert!(!exported.contains("password=secret"));
    }
}
