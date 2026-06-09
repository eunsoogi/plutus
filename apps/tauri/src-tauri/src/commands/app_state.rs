use anyhow::{Context, Result};
use serde_json::{json, Value};
use std::sync::Mutex;

use crate::audit::record_audit_event;
use crate::storage::{
    AppDataPaths, AppendRunEvent, Artifact, EnqueueLocalJob, FinalOutput, LocalJob,
    PersistFinalOutput, PlutusDatabase, Portfolio, Position, ResearchRun, RunEvent, Watchlist,
    WriteArtifactFile, MVP_PROFILE_ID,
};

use super::inputs::{
    CreatePortfolioInput, CreateWatchlistInput, PositionInput, StartResearchRunInput,
    UpdatePositionInput, UpdateWatchlistItemInput, WatchlistItemInput,
};
use super::PlutusCommands;

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

    pub(super) fn with_commands<T>(
        &self,
        f: impl FnOnce(PlutusCommands<'_>) -> Result<T>,
    ) -> Result<T> {
        let db = self
            .db
            .lock()
            .map_err(|_| anyhow::anyhow!("database lock poisoned"))?;
        f(PlutusCommands::new_with_paths(&db, &self.paths))
    }

    pub(super) fn with_db<T>(
        &self,
        f: impl FnOnce(&PlutusDatabase, &AppDataPaths) -> Result<T>,
    ) -> Result<T> {
        let db = self
            .db
            .lock()
            .map_err(|_| anyhow::anyhow!("database lock poisoned"))?;
        f(&db, &self.paths)
    }
}

pub(super) fn command_result<T>(result: Result<T>) -> std::result::Result<T, String> {
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
