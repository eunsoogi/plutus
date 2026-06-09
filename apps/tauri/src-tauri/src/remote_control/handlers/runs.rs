use anyhow::{Context, Result};
use rusqlite::params;
use serde_json::json;

use crate::commands::{PlutusCommands, StartResearchRunInput};
use crate::storage::{now, AppDataPaths, PlutusDatabase};

use super::super::authorization::assert_portfolio_belongs_to_profile;
use super::super::types::RemoteCommandRequest;

pub(in crate::remote_control) fn cancel_run(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let run_id = request
        .payload
        .get("runId")
        .and_then(|value| value.as_str())
        .context("runId is required")?;
    db.conn.execute(
        "UPDATE research_runs SET status = 'cancelled', completed_at = ?1 WHERE id = ?2 AND profile_id = ?3 AND status NOT IN ('completed', 'failed')",
        params![now(), run_id, profile_id],
    )?;
    Ok(json!({"runId": run_id, "status": "cancelled"}))
}

pub(in crate::remote_control) fn get_run(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let run_id = request
        .payload
        .get("runId")
        .and_then(|value| value.as_str())
        .context("runId is required")?;
    Ok(db.conn.query_row(
        "SELECT id, profile_id, portfolio_id, status, user_request, selected_team, codex_thread_id, workspace_path, recommendation_category FROM research_runs WHERE id = ?1 AND profile_id = ?2",
        params![run_id, profile_id],
        |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "profileId": row.get::<_, String>(1)?,
                "portfolioId": row.get::<_, Option<String>>(2)?,
                "status": row.get::<_, String>(3)?,
                "userRequest": row.get::<_, String>(4)?,
                "selectedTeam": row.get::<_, String>(5)?,
                "codexThreadId": row.get::<_, Option<String>>(6)?,
                "workspacePath": row.get::<_, String>(7)?,
                "recommendationCategory": row.get::<_, Option<String>>(8)?,
            }))
        },
    )?)
}

pub(in crate::remote_control) fn start_run(
    db: &PlutusDatabase,
    paths: Option<&AppDataPaths>,
    request: &RemoteCommandRequest,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let portfolio_id = request
        .payload
        .get("portfolioId")
        .and_then(|value| value.as_str());
    if let Some(portfolio_id) = portfolio_id {
        assert_portfolio_belongs_to_profile(db, portfolio_id, profile_id)?;
    }
    let user_request = request
        .payload
        .get("userRequest")
        .and_then(|value| value.as_str())
        .unwrap_or("Remote Plutus research request.");
    let selected_team = request
        .payload
        .get("selectedTeam")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let commands = paths
        .map(|paths| PlutusCommands::new_with_paths(db, paths))
        .unwrap_or_else(|| PlutusCommands::new(db));
    let run = commands.start_research_run(StartResearchRunInput {
        profile_id: profile_id.to_string(),
        portfolio_id: portfolio_id.map(str::to_string),
        user_request: user_request.to_string(),
        selected_team,
    })?;
    Ok(json!({
        "id": run.id,
        "profileId": run.profile_id,
        "status": run.status,
        "selectedTeam": run.selected_team,
        "recommendationCategory": run.recommendation_category,
        "codexThreadId": run.codex_thread_id,
        "workspacePath": run.workspace_path,
    }))
}
