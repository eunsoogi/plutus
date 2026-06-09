use anyhow::{bail, Result};
use serde_json::json;

use crate::audit::record_audit_event;
use crate::storage::{now, AppDataPaths, PlutusDatabase};

use super::authorization::{authorize_remote_command, remote_session_profile_id};
use super::handlers;
use super::security::consume_remote_command_nonce;
use super::types::{RemoteCommandExecutionResponse, RemoteCommandRequest};

pub fn execute_authorized_remote_command(
    db: &PlutusDatabase,
    paths: Option<&AppDataPaths>,
    request: &RemoteCommandRequest,
) -> Result<RemoteCommandExecutionResponse> {
    let authorization = authorize_remote_command(db, request)?;
    if !authorization.permission_granted {
        return Ok(RemoteCommandExecutionResponse {
            authorization,
            data: json!(null),
            host_timestamp: now(),
        });
    }
    consume_remote_command_nonce(db, request)?;
    let paired_profile_id = remote_session_profile_id(db, &request.session_id)?;
    let data = match request.command_type.as_str() {
        "portfolios.list" | "portfolio.list" => handlers::list_portfolios(db, &paired_profile_id)?,
        "watchlists.list" | "watchlist.list" => handlers::list_watchlists(db, &paired_profile_id)?,
        "run.cancel" | "researchRuns.cancel" => {
            handlers::cancel_run(db, request, &paired_profile_id)?
        }
        "run.get" | "researchRuns.get" => handlers::get_run(db, request, &paired_profile_id)?,
        "run.start" | "researchRuns.start" => {
            handlers::start_run(db, paths, request, &paired_profile_id)?
        }
        "artifact.get" | "artifacts.get" => {
            handlers::get_artifact(db, request, &paired_profile_id)?
        }
        "artifact.openLocalFile" | "artifacts.openLocalFile" => {
            handlers::open_local_artifact_file(db, request, &paired_profile_id)?
        }
        "position.updateThesis"
        | "portfolio.updatePositionThesis"
        | "portfolio.update_position_thesis" => {
            handlers::update_position_thesis(db, request, &paired_profile_id)?
        }
        "watchlist.updateItem" | "watchlist.update_item" | "watchlists.updateItem" => {
            handlers::update_watchlist_item(db, request, &paired_profile_id)?
        }
        "memory.listActivity" | "memory.activity" => {
            handlers::list_memory_activity(db, &paired_profile_id)?
        }
        "memory.update" | "memory.archive" | "memory.forget" | "memory.setCategoryEnabled" => {
            handlers::reject_memory_mutation(request)?
        }
        "wiki.listPages" | "wiki.list" => handlers::list_wiki_pages(db, &paired_profile_id)?,
        "wiki.getPage" | "wiki.get" => handlers::get_wiki_page(db, request, &paired_profile_id)?,
        "wiki.listActivity" => handlers::list_wiki_activity(db, &paired_profile_id)?,
        "wiki.revertRevision" => handlers::reject_wiki_mutation(request)?,
        command => bail!("unsupported remote command {command}"),
    };
    record_audit_event(
        db,
        Some(&paired_profile_id),
        None,
        "remote",
        "remote.command_executed",
        &request.command_id,
        &json!({"commandType": request.command_type}),
    )?;
    Ok(RemoteCommandExecutionResponse {
        authorization,
        data,
        host_timestamp: now(),
    })
}
