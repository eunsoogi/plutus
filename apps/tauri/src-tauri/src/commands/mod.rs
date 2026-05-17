use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::audit::record_audit_event;
use crate::security::{assert_no_trade_tool, redact_secrets};
use crate::storage::{
    new_id, now, Artifact, PlutusDatabase, Portfolio, PortfolioRepository, ResearchRun, Watchlist,
    MVP_PROFILE_ID,
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

pub struct PlutusCommands<'a> {
    pub db: &'a PlutusDatabase,
}

impl<'a> PlutusCommands<'a> {
    pub fn new(db: &'a PlutusDatabase) -> Self {
        Self { db }
    }

    pub fn list_portfolios(&self, profile_id: &str) -> Result<Vec<Portfolio>> {
        self.db.list_portfolios(profile_id)
    }

    pub fn create_portfolio(&self, input: CreatePortfolioInput) -> Result<Portfolio> {
        let portfolio =
            self.db
                .create_portfolio(&input.profile_id, &input.name, &input.base_currency)?;
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
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
    }

    pub fn start_research_run(&self, input: StartResearchRunInput) -> Result<ResearchRun> {
        let request = redact_secrets(&input.user_request);
        if request.trim().is_empty() {
            bail!("research request cannot be empty");
        }
        let selected_team = input
            .selected_team
            .unwrap_or_else(|| "portfolio_review_committee".to_string());
        let run = ResearchRun {
            id: new_id(),
            profile_id: input.profile_id,
            portfolio_id: input.portfolio_id,
            status: "queued".to_string(),
            user_request: request,
            selected_team,
            codex_thread_id: None,
            workspace_path: format!("runs/{}", new_id()),
            recommendation_category: None,
        };
        self.db.conn.execute(
            "INSERT INTO research_runs(id, profile_id, portfolio_id, status, user_request, selected_team, codex_thread_id, workspace_path, custom_agent_versions, local_tool_config_hash, model_config, started_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, '{}', 'local-tools-v1', '{}', ?8)",
            params![run.id, run.profile_id, run.portfolio_id, run.status, run.user_request, run.selected_team, run.workspace_path, now()],
        )?;
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

    pub fn assert_command_surface_safe(&self, command_name: &str) -> Result<()> {
        assert_no_trade_tool(command_name)
    }
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
        assert_eq!(commands.get_artifact(&artifact_id).unwrap().artifact_type, "run_card");
        commands.cancel_research_run(&run.id).unwrap();
        assert_eq!(commands.get_research_run(&run.id).unwrap().status, "cancelled");
    }

    #[test]
    fn command_surface_blocks_trade_tools() {
        let db = PlutusDatabase::in_memory().unwrap();
        let commands = PlutusCommands::new(&db);
        assert!(commands.assert_command_surface_safe("trade.place_order").is_err());
        assert!(commands.assert_command_surface_safe("researchRuns.start").is_ok());
    }
}
