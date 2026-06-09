use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::json;
use std::fs;

use crate::audit::record_audit_event;
use crate::remote_transport::forward_event_to_paired_sessions;
use crate::security::{assert_no_trade_tool, redact_secrets};
use crate::storage::{
    now, sha256_hex, AppendRunEvent, NewResearchRun, PersistFinalOutput, ResearchRun,
};

use super::inputs::StartResearchRunInput;
use super::runtime::{next_run_event_sequence, CodexRuntimeStart};
use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
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

    pub fn assert_command_surface_safe(&self, command_name: &str) -> Result<()> {
        assert_no_trade_tool(command_name)
    }
}
