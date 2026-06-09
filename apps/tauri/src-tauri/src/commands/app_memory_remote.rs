use anyhow::Result;
use rusqlite::params;
use serde_json::{json, Value};

use crate::audit::record_audit_event;
use crate::remote_control::{
    execute_authorized_remote_command, list_devices, pair_device, revoke_device,
    RemoteCommandExecutionResponse, RemoteCommandRequest, RemoteDevice, RemoteSession,
};
use crate::secure_store::SecureStore;
use crate::storage::{new_id, now, PlutusDatabase, MVP_PROFILE_ID};

use super::app_state::{command_result, AppState};
use super::inputs::{PairRemoteDeviceInput, PrepareRemoteUnlockInput};

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
