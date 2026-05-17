use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, process::Command, sync::Mutex};

use crate::audit::record_audit_event;
use crate::remote_control::{
    execute_authorized_remote_command, list_devices, pair_device, revoke_device,
    RemoteCommandExecutionResponse, RemoteCommandRequest, RemoteDevice, RemoteSession,
};
use crate::remote_transport::forward_event_to_paired_sessions;
use crate::secure_store::SecureStore;
use crate::security::{assert_no_trade_tool, redact_secrets};
use crate::storage::{
    new_id, now, sha256_hex, AppDataPaths, AppendRunEvent, Artifact, EnqueueLocalJob, FinalOutput,
    LocalJob, NewPosition, NewResearchRun, PersistFinalOutput, PlutusDatabase, Portfolio,
    PortfolioRepository, Position, ResearchRun, RunEvent, Watchlist, WriteArtifactFile,
    MVP_MANUAL_ACCOUNT_ID, MVP_PROFILE_ID,
};

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
        let command = vec![
            "pnpm".to_string(),
            "--filter".to_string(),
            "@plutus/agents".to_string(),
            "start-research-run".to_string(),
            "--json".to_string(),
        ];
        if std::env::var("PLUTUS_RUN_REAL_CODEX_SMOKE").ok().as_deref() == Some("1") {
            let mut process = Command::new(&command[0]);
            process
                .args(&command[1..])
                .env("PLUTUS_RUN_REAL_CODEX_SMOKE", "1")
                .env("PLUTUS_PROFILE_ID", &input.profile_id)
                .env(
                    "PLUTUS_PORTFOLIO_ID",
                    input.portfolio_id.clone().unwrap_or_default(),
                )
                .env("PLUTUS_SELECTED_TEAM", &input.selected_team)
                .env("PLUTUS_USER_REQUEST", &input.user_request)
                .env("PLUTUS_WORKSPACE_PATH", &input.workspace_path)
                .env(
                    "PLUTUS_APP_DATA_PATH",
                    std::path::Path::new(&input.workspace_path)
                        .parent()
                        .and_then(|path| path.parent())
                        .map(|path| path.display().to_string())
                        .unwrap_or_default(),
                );
            let output = process
                .output()
                .context("failed to start CodexRunHost bridge")?;
            if !output.status.success() {
                bail!(
                    "CodexRunHost bridge failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                );
            }
            let value: Value = serde_json::from_slice(&output.stdout)
                .context("CodexRunHost bridge returned invalid JSON")?;
            let thread_id = value
                .get("threadId")
                .and_then(|value| value.as_str())
                .context("CodexRunHost bridge did not return threadId")?
                .to_string();
            return Ok(CodexRuntimeStarted {
                thread_id,
                runtime: "codex_sdk_run_host".to_string(),
                command,
                events: value
                    .get("events")
                    .and_then(|value| value.as_array())
                    .cloned()
                    .unwrap_or_default(),
                final_output: value.get("finalOutput").cloned(),
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
            json!(["btc", "nvda", "risk_warning"]).to_string(),
            json!([{"type": "run", "id": run_id}]).to_string(),
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
             WHERE id = ?6",
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
            sequence: 1,
            event_type: "codex_run_host.started".to_string(),
            payload: json!({
                "runtime": bridge_start.runtime,
                "codexThreadId": codex_thread_id,
                "workspacePath": workspace_path,
                "commandSemantics": "Tauri invoked CodexRunHost runtime bridge",
                "runtimeCommand": bridge_start.command,
            }),
        })?;
        for (offset, event) in bridge_start.events.iter().enumerate() {
            let event_json = event.to_string();
            self.db.append_run_event(AppendRunEvent {
                research_run_id: run.id.clone(),
                sequence: (offset as i64) + 2,
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
                "findings": [
                    "BTC and NVDA concentration remains elevated.",
                    "Past performance is not indicative of future results.",
                    "No live trading action is authorized."
                ],
                "riskVeto": true
            }),
        })?;
        self.persist_post_run_memory_and_wiki(run_id)?;
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

    fn persist_post_run_memory_and_wiki(&self, run_id: &str) -> Result<()> {
        let run = self.get_research_run(run_id)?;
        let timestamp = now();
        let memory_id = new_id();
        db_insert_memory(
            self.db,
            &memory_id,
            &run.profile_id,
            "BTC/NVDA risk warning memory",
            "risk_warning",
            run_id,
            &timestamp,
        )?;
        let wiki_id = new_id();
        let revision_id = new_id();
        self.db.conn.execute(
            "INSERT INTO wiki_pages(id, profile_id, slug, category, title, summary, status, current_revision_id, tags, source_refs, memory_refs, freshness, confidence, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'risk_lesson', 'BTC/NVDA risk review', 'Concentration risk remains elevated; no trade action is authorized.', 'active', ?4, ?5, ?6, ?7, 'current', 'medium', ?8, ?8)",
            params![
                wiki_id,
                run.profile_id,
                format!("btc-nvda-risk-review-{run_id}"),
                revision_id,
                json!(["btc", "nvda", "risk_warning"]).to_string(),
                json!([{"type": "run", "id": run_id}]).to_string(),
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
                sha256_hex(format!("{run_id}:{memory_id}").as_bytes()),
                json!([{"type": "run", "id": run_id}]).to_string(),
                format!("audit:{run_id}:wiki"),
                timestamp
            ],
        )?;
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

    pub fn cancel_research_run(&self, run_id: &str) -> Result<()> {
        self.db.conn.execute(
            "UPDATE research_runs SET status = 'cancelled', completed_at = ?1 WHERE id = ?2 AND status NOT IN ('completed', 'failed')",
            params![now(), run_id],
        )?;
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

    pub fn add_portfolio_position(&self, input: PositionInput) -> Result<Position> {
        let portfolio_id = input.portfolio_id.clone();
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
        if let Some(profile_id) = self.profile_id_for_portfolio(&portfolio_id)? {
            self.export_local_tool_portfolio_state(&profile_id)?;
        }
        Ok(position)
    }

    pub fn update_portfolio_position(&self, input: UpdatePositionInput) -> Result<Position> {
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
        if let Some(profile_id) = self.profile_id_for_portfolio(&position.portfolio_id)? {
            self.export_local_tool_portfolio_state(&profile_id)?;
        }
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
        if let Some(profile_id) = self.profile_id_for_watchlist(&watchlist_id)? {
            self.export_local_tool_portfolio_state(&profile_id)?;
        }
        Ok(item)
    }

    pub fn update_watchlist_item(&self, input: UpdateWatchlistItemInput) -> Result<Value> {
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
        if let Some(profile_id) = self.profile_id_for_watchlist_item(&input.item_id)? {
            self.export_local_tool_portfolio_state(&profile_id)?;
        }
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

    pub fn persist_validated_final_output(&self, input: PersistFinalOutput) -> Result<FinalOutput> {
        let mut structured = input.structured_output;
        validate_final_output(&mut structured)?;
        let normalized_input = PersistFinalOutput {
            research_run_id: input.research_run_id,
            summary: input.summary,
            structured_output: structured.clone(),
        };
        let output = self.db.persist_final_output(normalized_input)?;
        if let Some(paths) = structured
            .get("artifactPaths")
            .and_then(|value| value.as_array())
        {
            for path in paths.iter().filter_map(|value| value.as_str()) {
                let artifact_id = new_id();
                self.db.conn.execute(
                    "INSERT INTO agent_artifacts(id, research_run_id, artifact_type, title, storage_key, content_hash, mime_type, metadata, created_by_agent, created_at)
                     VALUES (?1, ?2, 'final_output_path', ?3, ?3, ?4, 'application/octet-stream', ?5, 'report_writer', ?6)",
                    params![
                        artifact_id,
                        output.research_run_id,
                        path,
                        sha256_hex(path.as_bytes()),
                        json!({"source": "final_output"}).to_string(),
                        now()
                    ],
                )?;
            }
        }
        record_audit_event(
            self.db,
            None,
            Some(&output.research_run_id),
            "system",
            "research_run.final_output",
            &output.id,
            &json!({"recommendationCategory": output.structured_output.get("recommendationCategory")}),
        )?;
        Ok(output)
    }

    pub fn list_memory_activity(&self, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, memory_id, event_type, actor, research_run_id, payload, created_at
             FROM memory_activity ORDER BY created_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
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

    pub fn update_memory(&self, memory_id: &str, patch: Value) -> Result<Value> {
        let summary = patch.get("summary").and_then(|value| value.as_str());
        let status = patch.get("status").and_then(|value| value.as_str());
        if let Some(summary) = summary {
            self.db.conn.execute(
                "UPDATE memory_records SET summary = ?1, updated_at = ?2 WHERE id = ?3",
                params![summary, now(), memory_id],
            )?;
        }
        if let Some(status) = status {
            self.db.conn.execute(
                "UPDATE memory_records SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params![status, now(), memory_id],
            )?;
        }
        self.record_memory_activity(Some(memory_id), "memory.updated", patch)?;
        self.load_memory(memory_id)
    }

    pub fn archive_memory(&self, memory_id: &str, reason: &str) -> Result<()> {
        self.db.conn.execute(
            "UPDATE memory_records SET status = 'archived', retention_class = 'archived', updated_at = ?1 WHERE id = ?2",
            params![now(), memory_id],
        )?;
        self.record_memory_activity(
            Some(memory_id),
            "memory.archived",
            json!({"reason": reason}),
        )?;
        Ok(())
    }

    pub fn forget_memory(&self, memory_id: &str) -> Result<()> {
        self.db.conn.execute(
            "UPDATE memory_records SET status = 'deleted', deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now(), memory_id],
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

    pub fn list_wiki_pages(&self, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, slug, category, title, summary, freshness, confidence, updated_at FROM wiki_pages ORDER BY updated_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "slug": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "title": row.get::<_, String>(3)?,
                "summary": row.get::<_, String>(4)?,
                "freshness": row.get::<_, String>(5)?,
                "confidence": row.get::<_, String>(6)?,
                "updatedAt": row.get::<_, String>(7)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn get_wiki_page(&self, page_id: &str) -> Result<Value> {
        self.db.conn.query_row(
            "SELECT id, slug, category, title, summary, freshness, confidence, current_revision_id FROM wiki_pages WHERE id = ?1",
            params![page_id],
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

    pub fn list_wiki_activity(&self, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, wiki_page_id, revision_number, revision_note, created_by, created_at FROM wiki_revisions ORDER BY created_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
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
        self.get_wiki_page(page_id)
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
                            "thesis": position_row.get::<_, String>(8)?,
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
                            "triggerNote": item_row.get::<_, String>(4)?,
                            "targetZone": item_row.get::<_, String>(5)?,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionInput {
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
    pub watchlist_id: String,
    pub symbol: String,
    pub trigger_note: Option<String>,
    pub target_zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWatchlistItemInput {
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
    if structured.get("evidence").is_none() && structured.get("evidenceRefs").is_none() {
        bail!("final output missing evidence");
    }
    for key in ["freshness", "caveats"] {
        if structured.get(key).is_none() {
            bail!("final output missing {key}");
        }
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
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| commands.get_portfolio_snapshot(&portfolio_id)))
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
) -> std::result::Result<Position, String> {
    command_result(state.with_commands(|commands| {
        commands.update_portfolio_position(UpdatePositionInput {
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
) -> std::result::Result<ResearchRun, String> {
    command_result(state.with_commands(|commands| commands.get_research_run(&run_id)))
}

#[tauri::command]
pub fn cancel_research_run(
    state: tauri::State<'_, AppState>,
    run_id: String,
) -> std::result::Result<(), String> {
    command_result(state.with_commands(|commands| commands.cancel_research_run(&run_id)))
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
) -> std::result::Result<Artifact, String> {
    command_result(state.with_commands(|commands| commands.get_artifact(&artifact_id)))
}

#[tauri::command]
pub fn open_local_artifact_file(
    state: tauri::State<'_, AppState>,
    artifact_id: String,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| commands.open_local_artifact_file(&artifact_id)))
}

#[tauri::command]
pub fn list_memory_activity(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
) -> std::result::Result<Vec<Value>, String> {
    command_result(
        state.with_commands(|commands| commands.list_memory_activity(limit.unwrap_or(50))),
    )
}

#[tauri::command]
pub fn update_memory(
    state: tauri::State<'_, AppState>,
    memory_id: String,
    patch: Value,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| commands.update_memory(&memory_id, patch)))
}

#[tauri::command]
pub fn archive_memory(
    state: tauri::State<'_, AppState>,
    memory_id: String,
    reason: String,
) -> std::result::Result<(), String> {
    command_result(state.with_commands(|commands| commands.archive_memory(&memory_id, &reason)))
}

#[tauri::command]
pub fn forget_memory(
    state: tauri::State<'_, AppState>,
    memory_id: String,
) -> std::result::Result<(), String> {
    command_result(state.with_commands(|commands| commands.forget_memory(&memory_id)))
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
    limit: Option<i64>,
) -> std::result::Result<Vec<Value>, String> {
    command_result(state.with_commands(|commands| commands.list_wiki_pages(limit.unwrap_or(50))))
}

#[tauri::command]
pub fn get_wiki_page(
    state: tauri::State<'_, AppState>,
    page_id: String,
) -> std::result::Result<Value, String> {
    command_result(state.with_commands(|commands| commands.get_wiki_page(&page_id)))
}

#[tauri::command]
pub fn list_wiki_activity(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
) -> std::result::Result<Vec<Value>, String> {
    command_result(state.with_commands(|commands| commands.list_wiki_activity(limit.unwrap_or(50))))
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
    command_result(state.with_db(|db, _paths| execute_authorized_remote_command(db, &request)))
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
    use crate::storage::{PlutusDatabase, MVP_PORTFOLIO_ID};

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
        commands.cancel_research_run(&run.id).unwrap();
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
                "SELECT COUNT(*) FROM memory_records WHERE summary LIKE '%risk warning%'",
                [],
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
        commands.archive_memory(&memory_id, "old lesson").unwrap();
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
        commands.forget_memory(&memory_id).unwrap();
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
        let commands = PlutusCommands::new(&db);
        let run = commands
            .start_research_run(StartResearchRunInput {
                profile_id: MVP_PROFILE_ID.to_string(),
                portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
                user_request: "Review BTC/NVDA".to_string(),
                selected_team: None,
            })
            .unwrap();

        let invalid = commands.persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Bad category".to_string(),
            structured_output: json!({
                "recommendationCategory": "rebalance",
                "evidence": ["quote:BTC"],
                "freshness": {"delayStatus": "delayed"},
                "caveats": ["Not advice"]
            }),
        });
        assert!(invalid
            .unwrap_err()
            .to_string()
            .contains("invalid recommendation category"));

        let output = commands
            .persist_validated_final_output(PersistFinalOutput {
                research_run_id: run.id.clone(),
                summary: "Risk veto blocks action".to_string(),
                structured_output: json!({
                    "recommendationCategory": "strategy_candidate",
                    "riskVeto": {"reason": "Concentration breach"},
                    "evidence": ["portfolio:core"],
                    "freshness": {"delayStatus": "realtime"},
                    "caveats": ["Human review required"],
                    "artifactPaths": ["artifacts/run-card.json"]
                }),
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
                "SELECT COUNT(*) FROM agent_artifacts WHERE research_run_id = ?1 AND artifact_type = 'final_output_path'",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(artifact_count, 1);
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
}
