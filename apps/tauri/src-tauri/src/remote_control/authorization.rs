use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::json;

use crate::audit::record_audit_event;
use crate::storage::PlutusDatabase;

use super::pairing::host_kill_switch;
use super::security::{command_group, command_requires_unlock, valid_unlock_proof};
use super::types::{RemoteCommandRequest, RemoteCommandResponse};

pub(super) fn remote_session_profile_id(db: &PlutusDatabase, session_id: &str) -> Result<String> {
    db.conn
        .query_row(
            "SELECT d.profile_id
             FROM remote_sessions s JOIN remote_devices d ON d.id = s.remote_device_id
             WHERE s.id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .optional()?
        .context("remote session not found")
}

pub(super) fn assert_portfolio_belongs_to_profile(
    db: &PlutusDatabase,
    portfolio_id: &str,
    profile_id: &str,
) -> Result<()> {
    let matched: i64 = db.conn.query_row(
        "SELECT COUNT(*) FROM portfolios WHERE id = ?1 AND profile_id = ?2",
        params![portfolio_id, profile_id],
        |row| row.get(0),
    )?;
    if matched == 0 {
        bail!("remote command cannot access portfolio outside paired profile");
    }
    Ok(())
}

pub(super) fn assert_artifact_belongs_to_profile(
    db: &PlutusDatabase,
    artifact_id: &str,
    profile_id: &str,
) -> Result<()> {
    let matched: i64 = db.conn.query_row(
        "SELECT COUNT(*)
         FROM agent_artifacts a
         JOIN research_runs r ON r.id = a.research_run_id
         WHERE a.id = ?1 AND r.profile_id = ?2",
        params![artifact_id, profile_id],
        |row| row.get(0),
    )?;
    if matched == 0 {
        bail!("remote command cannot access artifact outside paired profile");
    }
    Ok(())
}

pub fn authorize_remote_command(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
) -> Result<RemoteCommandResponse> {
    let row = db
        .conn
        .query_row(
            "SELECT s.status, d.revoked_at, d.permissions, d.profile_id, d.id, s.session_key_ref
             FROM remote_sessions s JOIN remote_devices d ON d.id = s.remote_device_id
             WHERE s.id = ?1",
            params![request.session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .optional()?
        .context("remote session not found")?;

    let (status, revoked_at, permissions, profile_id, device_id, session_key_ref) = row;
    let mut warnings = Vec::new();
    let (kill_switch_enabled, kill_switch_reason) = host_kill_switch(db)?;
    if kill_switch_enabled {
        warnings.push(format!("host_kill_switch:{kill_switch_reason}"));
    }
    if status != "connected" {
        warnings.push(format!("session_{status}"));
    }
    if revoked_at.is_some() {
        warnings.push("device_revoked".to_string());
    }
    if request.session_key_ref.as_deref() != Some(session_key_ref.as_str()) {
        warnings.push("invalid_session_key_ref".to_string());
    }
    let group = command_group(&request.command_type);
    let parsed: serde_json::Value = serde_json::from_str(&permissions)?;
    let allowed = parsed
        .get("allowedCommandGroups")
        .and_then(|value| value.as_array())
        .map(|groups| groups.iter().any(|value| value.as_str() == Some(group)))
        .unwrap_or(false);
    if !allowed {
        warnings.push("permission_denied".to_string());
    }
    if command_requires_unlock(&request.command_type)
        && !valid_unlock_proof(
            db,
            request.unlock.as_ref(),
            &request.session_id,
            &request.command_id,
            &session_key_ref,
            &request.command_type,
            &request.payload,
        )
    {
        warnings.push("unlock_required".to_string());
    }
    let granted = warnings.is_empty();
    if !granted {
        record_audit_event(
            db,
            Some(&profile_id),
            None,
            "remote",
            "remote.permission_denied",
            &device_id,
            &json!({"commandType": request.command_type, "warnings": warnings}),
        )?;
    }
    Ok(RemoteCommandResponse {
        command_id: request.command_id.clone(),
        success: granted,
        warnings,
        permission_granted: granted,
    })
}
