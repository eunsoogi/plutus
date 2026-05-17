use anyhow::{bail, Context, Result};
use rand::RngCore;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::audit::record_audit_event;
use crate::commands::{PlutusCommands, StartResearchRunInput};
use crate::secure_store::remote_session_key_ref;
use crate::storage::{new_id, now, sha256_hex, PlutusDatabase};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PairingCode {
    pub code: String,
    pub host_id: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteDevice {
    pub id: String,
    pub profile_id: String,
    pub device_name: String,
    pub device_platform: String,
    pub public_key: String,
    pub permissions: serde_json::Value,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteSession {
    pub id: String,
    pub remote_device_id: String,
    pub status: String,
    pub host_address: String,
    pub session_key_ref: String,
    pub address_metadata: RemoteAddressMetadata,
    pub session_security: RemoteSessionSecurity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteAddressMetadata {
    pub source: String,
    pub host: String,
    pub port: u16,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteSessionSecurity {
    pub session_key_ref: String,
    pub cipher_suite: String,
    pub handshake_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteUnlockProof {
    pub method: String,
    pub session_key_ref: String,
    pub challenge: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteCommandRequest {
    pub command_id: String,
    pub session_id: String,
    pub session_key_ref: Option<String>,
    pub unlock: Option<RemoteUnlockProof>,
    pub command_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteCommandResponse {
    pub command_id: String,
    pub success: bool,
    pub warnings: Vec<String>,
    pub permission_granted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteCommandExecutionResponse {
    pub authorization: RemoteCommandResponse,
    pub data: serde_json::Value,
    pub host_timestamp: String,
}

pub fn create_pairing_code(host_id: &str) -> PairingCode {
    let mut bytes = [0u8; 4];
    rand::thread_rng().fill_bytes(&mut bytes);
    let value = u32::from_be_bytes(bytes) % 1_000_000;
    PairingCode {
        code: format!("{value:06}"),
        host_id: host_id.to_string(),
        expires_at: now(),
    }
}

pub fn pair_device(
    db: &PlutusDatabase,
    profile_id: &str,
    device_name: &str,
    device_platform: &str,
    public_key: &str,
    allowed_groups: &[&str],
) -> Result<RemoteSession> {
    pair_device_with_transport(
        db,
        profile_id,
        device_name,
        device_platform,
        public_key,
        allowed_groups,
        RemoteAddressMetadata {
            source: "discovery".to_string(),
            host: "127.0.0.1".to_string(),
            port: 7420,
            label: Some("local discovery".to_string()),
        },
    )
}

pub fn pair_device_with_transport(
    db: &PlutusDatabase,
    profile_id: &str,
    device_name: &str,
    device_platform: &str,
    public_key: &str,
    allowed_groups: &[&str],
    address_metadata: RemoteAddressMetadata,
) -> Result<RemoteSession> {
    if host_kill_switch(db)?.0 {
        bail!("remote control host kill switch is active");
    }
    if !matches!(device_platform, "ios" | "android") {
        bail!("unsupported remote device platform");
    }
    if address_metadata.host.trim().is_empty() {
        bail!("remote host address is required");
    }
    if !matches!(address_metadata.source.as_str(), "manual" | "discovery") {
        bail!("remote host address source is invalid");
    }
    if address_metadata.port == 0 {
        bail!("remote host port is invalid");
    }
    let device_id = new_id();
    let session_id = new_id();
    let key_ref = remote_session_key_ref(&session_id);
    let host_address = serde_json::to_string(&address_metadata)?;
    let session_security = RemoteSessionSecurity {
        session_key_ref: key_ref.clone(),
        cipher_suite: "x25519-chacha20poly1305".to_string(),
        handshake_ref: format!(
            "sha256:{}",
            sha256_hex(format!("{session_id}:{public_key}:{host_address}").as_bytes())
        ),
    };
    let timestamp = now();
    db.conn.execute(
        "INSERT INTO remote_devices(id, profile_id, device_name, device_platform, public_key, permissions, paired_at, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![
            device_id,
            profile_id,
            device_name,
            device_platform,
            public_key,
            json!({"allowedCommandGroups": allowed_groups}).to_string(),
            timestamp
        ],
    )?;
    db.conn.execute(
        "INSERT INTO remote_sessions(id, remote_device_id, status, host_address, session_key_ref, started_at, last_heartbeat_at)
         VALUES (?1, ?2, 'connected', ?3, ?4, ?5, ?5)",
        params![session_id, device_id, host_address, key_ref, now()],
    )?;
    record_audit_event(
        db,
        Some(profile_id),
        None,
        "system",
        "remote.device_connected",
        &device_id,
        &json!({"deviceName": device_name}),
    )?;
    Ok(RemoteSession {
        id: session_id,
        remote_device_id: device_id,
        status: "connected".to_string(),
        host_address,
        session_key_ref: key_ref,
        address_metadata,
        session_security,
    })
}

pub fn set_host_kill_switch(
    db: &PlutusDatabase,
    enabled: bool,
    reason: Option<&str>,
) -> Result<()> {
    let timestamp = now();
    db.conn.execute(
        "CREATE TABLE IF NOT EXISTS remote_host_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)",
        [],
    )?;
    db.conn.execute(
        "INSERT INTO remote_host_settings(key, value, updated_at) VALUES ('kill_switch', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![
            json!({"enabled": enabled, "reason": reason.unwrap_or("disabled")}).to_string(),
            timestamp
        ],
    )?;
    Ok(())
}

fn host_kill_switch(db: &PlutusDatabase) -> Result<(bool, String)> {
    db.conn.execute(
        "CREATE TABLE IF NOT EXISTS remote_host_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)",
        [],
    )?;
    let value: Option<String> = db
        .conn
        .query_row(
            "SELECT value FROM remote_host_settings WHERE key = 'kill_switch'",
            [],
            |row| row.get(0),
        )
        .optional()?;
    let parsed: serde_json::Value = value
        .as_deref()
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or_else(|| json!({"enabled": false, "reason": ""}));
    Ok((
        parsed
            .get("enabled")
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        parsed
            .get("reason")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string(),
    ))
}

pub fn unlock_challenge(session_id: &str, command_id: &str) -> String {
    format!(
        "sha256:{}",
        sha256_hex(format!("{session_id}:{command_id}").as_bytes())
    )
}

pub fn revoke_device(db: &PlutusDatabase, device_id: &str) -> Result<()> {
    let timestamp = now();
    db.conn.execute(
        "UPDATE remote_devices SET revoked_at = ?1 WHERE id = ?2",
        params![timestamp, device_id],
    )?;
    db.conn.execute(
        "UPDATE remote_sessions SET status = 'revoked', ended_at = ?1 WHERE remote_device_id = ?2",
        params![timestamp, device_id],
    )?;
    Ok(())
}

pub fn list_devices(db: &PlutusDatabase, profile_id: &str) -> Result<Vec<RemoteDevice>> {
    let mut stmt = db.conn.prepare(
        "SELECT id, profile_id, device_name, device_platform, public_key, permissions, revoked_at
         FROM remote_devices WHERE profile_id = ?1 ORDER BY paired_at DESC",
    )?;
    let rows = stmt.query_map(params![profile_id], |row| {
        let permissions: String = row.get(5)?;
        Ok(RemoteDevice {
            id: row.get(0)?,
            profile_id: row.get(1)?,
            device_name: row.get(2)?,
            device_platform: row.get(3)?,
            public_key: row.get(4)?,
            permissions: serde_json::from_str(&permissions).unwrap_or_else(|_| json!({})),
            revoked_at: row.get(6)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

pub fn mark_session_stale(db: &PlutusDatabase, session_id: &str) -> Result<()> {
    db.conn.execute(
        "UPDATE remote_sessions SET status = 'stale' WHERE id = ?1",
        params![session_id],
    )?;
    Ok(())
}

fn remote_session_profile_id(db: &PlutusDatabase, session_id: &str) -> Result<String> {
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

fn assert_portfolio_belongs_to_profile(
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

fn assert_artifact_belongs_to_profile(
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

fn assert_wiki_page_belongs_to_profile(
    db: &PlutusDatabase,
    page_id: &str,
    profile_id: &str,
) -> Result<()> {
    let matched: i64 = db.conn.query_row(
        "SELECT COUNT(*) FROM wiki_pages WHERE id = ?1 AND profile_id = ?2",
        params![page_id, profile_id],
        |row| row.get(0),
    )?;
    if matched == 0 {
        bail!("remote command cannot access wiki page outside paired profile");
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
            request.unlock.as_ref(),
            &request.session_id,
            &request.command_id,
            &session_key_ref,
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

pub fn execute_authorized_remote_command(
    db: &PlutusDatabase,
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
    let paired_profile_id = remote_session_profile_id(db, &request.session_id)?;
    let data = match request.command_type.as_str() {
        "portfolios.list" | "portfolio.list" => {
            let mut stmt = db.conn.prepare(
                "SELECT id, profile_id, name, base_currency FROM portfolios WHERE profile_id = ?1 ORDER BY name",
            )?;
            let rows = stmt.query_map(params![paired_profile_id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "profileId": row.get::<_, String>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "baseCurrency": row.get::<_, String>(3)?,
                }))
            })?;
            json!(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        }
        "watchlists.list" | "watchlist.list" => {
            let mut stmt = db.conn.prepare(
                "SELECT id, profile_id, name FROM watchlists WHERE profile_id = ?1 ORDER BY name",
            )?;
            let rows = stmt.query_map(params![paired_profile_id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "profileId": row.get::<_, String>(1)?,
                    "name": row.get::<_, String>(2)?,
                }))
            })?;
            json!(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        }
        "run.cancel" | "researchRuns.cancel" => {
            let run_id = request
                .payload
                .get("runId")
                .and_then(|value| value.as_str())
                .context("runId is required")?;
            db.conn.execute(
                "UPDATE research_runs SET status = 'cancelled', completed_at = ?1 WHERE id = ?2 AND profile_id = ?3 AND status NOT IN ('completed', 'failed')",
                params![now(), run_id, paired_profile_id],
            )?;
            json!({"runId": run_id, "status": "cancelled"})
        }
        "run.get" | "researchRuns.get" => {
            let run_id = request
                .payload
                .get("runId")
                .and_then(|value| value.as_str())
                .context("runId is required")?;
            db.conn.query_row(
                "SELECT id, profile_id, portfolio_id, status, user_request, selected_team, codex_thread_id, workspace_path, recommendation_category FROM research_runs WHERE id = ?1 AND profile_id = ?2",
                params![run_id, paired_profile_id],
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
            )?
        }
        "run.start" | "researchRuns.start" => {
            let portfolio_id = request
                .payload
                .get("portfolioId")
                .and_then(|value| value.as_str());
            if let Some(portfolio_id) = portfolio_id {
                assert_portfolio_belongs_to_profile(db, portfolio_id, &paired_profile_id)?;
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
            let run = PlutusCommands::new(db).start_research_run(StartResearchRunInput {
                profile_id: paired_profile_id.clone(),
                portfolio_id: portfolio_id.map(str::to_string),
                user_request: user_request.to_string(),
                selected_team,
            })?;
            json!({
                "id": run.id,
                "profileId": run.profile_id,
                "status": run.status,
                "selectedTeam": run.selected_team,
                "recommendationCategory": run.recommendation_category,
                "codexThreadId": run.codex_thread_id,
                "workspacePath": run.workspace_path,
            })
        }
        "artifact.get" | "artifacts.get" => {
            let artifact_id = request
                .payload
                .get("artifactId")
                .and_then(|value| value.as_str())
                .context("artifactId is required")?;
            db.conn.query_row(
                "SELECT a.id, a.research_run_id, a.artifact_type, a.title, a.storage_key, a.content_hash, a.mime_type
                 FROM agent_artifacts a
                 JOIN research_runs r ON r.id = a.research_run_id
                 WHERE a.id = ?1 AND r.profile_id = ?2",
                params![artifact_id, paired_profile_id],
                |row| {
                    Ok(json!({
                        "id": row.get::<_, String>(0)?,
                        "researchRunId": row.get::<_, String>(1)?,
                        "artifactType": row.get::<_, String>(2)?,
                        "title": row.get::<_, String>(3)?,
                        "storageKey": row.get::<_, String>(4)?,
                        "contentHash": row.get::<_, String>(5)?,
                        "mimeType": row.get::<_, String>(6)?,
                    }))
                },
            )?
        }
        "artifact.openLocalFile" | "artifacts.openLocalFile" => {
            let artifact_id = request
                .payload
                .get("artifactId")
                .and_then(|value| value.as_str())
                .context("artifactId is required")?;
            assert_artifact_belongs_to_profile(db, artifact_id, &paired_profile_id)?;
            json!({"artifactId": artifact_id, "opened": true})
        }
        "position.updateThesis"
        | "portfolio.updatePositionThesis"
        | "portfolio.update_position_thesis" => {
            let position_id = request
                .payload
                .get("positionId")
                .and_then(|value| value.as_str())
                .context("positionId is required")?;
            let thesis = request
                .payload
                .get("thesis")
                .and_then(|value| value.as_str())
                .context("thesis is required")?;
            db.conn.execute(
                "UPDATE positions SET thesis = ?1, updated_at = ?2
                 WHERE id = ?3 AND portfolio_id IN (SELECT id FROM portfolios WHERE profile_id = ?4)",
                params![thesis, now(), position_id, paired_profile_id],
            )?;
            json!({"positionId": position_id, "thesis": thesis})
        }
        "watchlist.updateItem" | "watchlist.update_item" | "watchlists.updateItem" => {
            let item_id = request
                .payload
                .get("itemId")
                .and_then(|value| value.as_str())
                .context("itemId is required")?;
            if let Some(note) = request
                .payload
                .get("triggerNote")
                .and_then(|value| value.as_str())
            {
                db.conn.execute(
                    "UPDATE watchlist_items SET trigger_note = ?1, updated_at = ?2
                     WHERE id = ?3 AND watchlist_id IN (SELECT id FROM watchlists WHERE profile_id = ?4)",
                    params![note, now(), item_id, paired_profile_id],
                )?;
            }
            json!({"itemId": item_id, "updated": true})
        }
        "memory.listActivity" | "memory.activity" => {
            let mut stmt = db.conn.prepare(
                "SELECT ma.id, ma.memory_id, ma.event_type, ma.actor, ma.payload, ma.created_at
                 FROM memory_activity ma
                 LEFT JOIN memory_records mr ON mr.id = ma.memory_id
                 WHERE ma.memory_id IS NULL OR mr.profile_id = ?1
                 ORDER BY ma.created_at DESC LIMIT 50",
            )?;
            let rows = stmt.query_map(params![paired_profile_id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "memoryId": row.get::<_, Option<String>>(1)?,
                    "eventType": row.get::<_, String>(2)?,
                    "actor": row.get::<_, String>(3)?,
                    "payload": row.get::<_, String>(4)?,
                    "createdAt": row.get::<_, String>(5)?,
                }))
            })?;
            json!(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        }
        "memory.update" => {
            let memory_id = request
                .payload
                .get("memoryId")
                .and_then(|value| value.as_str())
                .context("memoryId is required")?;
            let patch = request
                .payload
                .get("patch")
                .cloned()
                .unwrap_or_else(|| json!({}));
            if let Some(summary) = patch.get("summary").and_then(|value| value.as_str()) {
                db.conn.execute(
                    "UPDATE memory_records SET summary = ?1, updated_at = ?2 WHERE id = ?3 AND profile_id = ?4",
                    params![summary, now(), memory_id, paired_profile_id],
                )?;
            }
            json!({"memoryId": memory_id, "updated": true})
        }
        "memory.archive" => {
            let memory_id = request
                .payload
                .get("memoryId")
                .and_then(|value| value.as_str())
                .context("memoryId is required")?;
            db.conn.execute(
                "UPDATE memory_records SET retention_class = 'archived', status = 'archived', updated_at = ?1 WHERE id = ?2 AND profile_id = ?3",
                params![now(), memory_id, paired_profile_id],
            )?;
            json!({"memoryId": memory_id, "archived": true})
        }
        "memory.forget" => {
            let memory_id = request
                .payload
                .get("memoryId")
                .and_then(|value| value.as_str())
                .context("memoryId is required")?;
            db.conn.execute(
                "UPDATE memory_records SET status = 'deleted', deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND profile_id = ?3",
                params![now(), memory_id, paired_profile_id],
            )?;
            json!({"memoryId": memory_id, "deleted": true})
        }
        "memory.setCategoryEnabled" => {
            json!({"updated": true})
        }
        "wiki.listPages" | "wiki.list" => {
            let mut stmt = db.conn.prepare(
                "SELECT id, title, slug, status, updated_at FROM wiki_pages WHERE profile_id = ?1 ORDER BY updated_at DESC LIMIT 50",
            )?;
            let rows = stmt.query_map(params![paired_profile_id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "slug": row.get::<_, String>(2)?,
                    "status": row.get::<_, String>(3)?,
                    "updatedAt": row.get::<_, String>(4)?,
                }))
            })?;
            json!(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        }
        "wiki.getPage" | "wiki.get" => {
            let page_id = request
                .payload
                .get("pageId")
                .and_then(|value| value.as_str())
                .context("pageId is required")?;
            db.conn.query_row(
                "SELECT id, title, slug, status, updated_at FROM wiki_pages WHERE id = ?1 AND profile_id = ?2",
                params![page_id, paired_profile_id],
                |row| {
                    Ok(json!({
                        "id": row.get::<_, String>(0)?,
                        "title": row.get::<_, String>(1)?,
                        "slug": row.get::<_, String>(2)?,
                        "status": row.get::<_, String>(3)?,
                        "updatedAt": row.get::<_, String>(4)?,
                    }))
                },
            )?
        }
        "wiki.listActivity" => {
            let mut stmt = db.conn.prepare(
                "SELECT wr.id, wr.wiki_page_id, wr.revision_note, wr.created_by, wr.created_at
                 FROM wiki_revisions wr
                 JOIN wiki_pages wp ON wp.id = wr.wiki_page_id
                 WHERE wp.profile_id = ?1
                 ORDER BY wr.created_at DESC LIMIT 50",
            )?;
            let rows = stmt.query_map(params![paired_profile_id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "pageId": row.get::<_, String>(1)?,
                    "eventType": "revision",
                    "actor": row.get::<_, String>(3)?,
                    "payload": {"revisionNote": row.get::<_, String>(2)?},
                    "createdAt": row.get::<_, String>(4)?,
                }))
            })?;
            json!(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        }
        "wiki.revertRevision" => {
            let page_id = request
                .payload
                .get("pageId")
                .and_then(|value| value.as_str())
                .context("pageId is required")?;
            let revision_id = request
                .payload
                .get("revisionId")
                .and_then(|value| value.as_str())
                .context("revisionId is required")?;
            let reason = request
                .payload
                .get("reason")
                .and_then(|value| value.as_str())
                .unwrap_or("Remote revert request.");
            assert_wiki_page_belongs_to_profile(db, page_id, &paired_profile_id)?;
            PlutusCommands::new(db).revert_wiki_revision(page_id, revision_id, reason)?
        }
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

pub fn command_group(command_type: &str) -> &str {
    command_type.split('.').next().unwrap_or("unknown")
}

fn valid_unlock_proof(
    proof: Option<&RemoteUnlockProof>,
    session_id: &str,
    command_id: &str,
    session_key_ref: &str,
) -> bool {
    let Some(proof) = proof else {
        return false;
    };
    proof.method == "biometric"
        && proof.session_key_ref == session_key_ref
        && proof.challenge == unlock_challenge(session_id, command_id)
}

fn command_requires_unlock(command_type: &str) -> bool {
    matches!(
        command_type,
        "run.start"
            | "researchRuns.start"
            | "run.cancel"
            | "researchRuns.cancel"
            | "position.updateThesis"
            | "portfolio.updatePositionThesis"
            | "portfolio.update_position_thesis"
            | "watchlist.updateItem"
            | "watchlist.update_item"
            | "watchlists.updateItem"
            | "artifact.get"
            | "artifacts.get"
            | "artifact.openLocalFile"
            | "artifacts.openLocalFile"
            | "memory.update"
            | "memory.archive"
            | "memory.forget"
            | "wiki.get"
            | "wiki.getPage"
            | "wiki.revertRevision"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::{PlutusDatabase, MVP_PROFILE_ID};

    #[test]
    fn pairs_devices_with_secure_session_reference() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let code = create_pairing_code("mac-host");
        assert_eq!(code.code.len(), 6);
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            "public-key",
            &["portfolio", "run", "artifact", "memory", "wiki"],
        )
        .unwrap();
        assert!(session.session_key_ref.starts_with("secure://"));
        assert_eq!(session.address_metadata.source, "discovery");
        assert_eq!(
            session.session_security.session_key_ref,
            session.session_key_ref
        );
        assert_eq!(
            session.session_security.cipher_suite,
            "x25519-chacha20poly1305"
        );
        assert!(session
            .session_security
            .handshake_ref
            .starts_with("sha256:"));
        assert_ne!(session.host_address, "plutus.local:7420");
    }

    #[test]
    fn validates_manual_transport_metadata_and_host_kill_switch() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();

        let manual = RemoteAddressMetadata {
            source: "manual".to_string(),
            host: "192.168.1.20".to_string(),
            port: 7420,
            label: Some("home lan".to_string()),
        };
        let session = pair_device_with_transport(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            "public-key",
            &["portfolio"],
            manual.clone(),
        )
        .unwrap();
        assert_eq!(session.address_metadata, manual);

        let invalid = pair_device_with_transport(
            &db,
            MVP_PROFILE_ID,
            "Broken",
            "ios",
            "public-key",
            &["portfolio"],
            RemoteAddressMetadata {
                source: "manual".to_string(),
                host: "".to_string(),
                port: 7420,
                label: None,
            },
        );
        assert!(invalid
            .unwrap_err()
            .to_string()
            .contains("remote host address is required"));

        set_host_kill_switch(&db, true, Some("owner disabled remote access")).unwrap();
        let denied = authorize_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: new_id(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: None,
                command_type: "portfolio.list".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert!(denied
            .warnings
            .contains(&"host_kill_switch:owner disabled remote access".to_string()));

        let blocked_pairing = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Android",
            "android",
            "public-key",
            &["portfolio"],
        );
        assert!(blocked_pairing
            .unwrap_err()
            .to_string()
            .contains("remote control host kill switch is active"));
    }

    #[test]
    fn denies_revoked_stale_and_unpermitted_remote_commands() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Android",
            "android",
            "public-key",
            &["portfolio"],
        )
        .unwrap();
        let denied = authorize_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: new_id(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: None,
                command_type: "run.start".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert!(!denied.success);
        assert!(denied.warnings.contains(&"permission_denied".to_string()));

        mark_session_stale(&db, &session.id).unwrap();
        let stale = authorize_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: new_id(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: None,
                command_type: "portfolio.list".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert!(stale.warnings.contains(&"session_stale".to_string()));

        revoke_device(&db, &session.remote_device_id).unwrap();
        let revoked = authorize_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: new_id(),
                session_id: session.id,
                session_key_ref: Some(session.session_key_ref),
                unlock: None,
                command_type: "portfolio.list".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert!(revoked.warnings.contains(&"device_revoked".to_string()));
    }

    #[test]
    fn executes_authorized_remote_command_with_data_timestamp_and_audit() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            "public-key",
            &["portfolios"],
        )
        .unwrap();

        let response = execute_authorized_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: new_id(),
                session_id: session.id,
                session_key_ref: Some(session.session_key_ref),
                unlock: None,
                command_type: "portfolios.list".to_string(),
                payload: json!({"profileId": MVP_PROFILE_ID}),
            },
        )
        .unwrap();

        assert!(response.authorization.permission_granted);
        assert!(response.host_timestamp.contains('T'));
        assert_eq!(
            response.data.as_array().unwrap()[0]["name"],
            "Core Portfolio"
        );
        let audit_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM audit_events WHERE action = 'remote.command_executed'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(audit_count, 1);
    }

    #[test]
    fn remote_run_start_persists_completed_lifecycle_outputs() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            "public-key",
            &["run"],
        )
        .unwrap();
        let response = execute_authorized_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-remote-run".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: Some(RemoteUnlockProof {
                    method: "biometric".to_string(),
                    session_key_ref: session.session_key_ref.clone(),
                    challenge: unlock_challenge(&session.id, "cmd-remote-run"),
                }),
                command_type: "run.start".to_string(),
                payload: json!({"profileId": MVP_PROFILE_ID, "userRequest": "Remote review"}),
            },
        )
        .unwrap();
        let run_id = response.data["id"].as_str().unwrap();
        assert_eq!(response.data["status"], "completed");
        let output_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                params![run_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(output_count, 1);
        let memory_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM memory_records WHERE source_refs LIKE ?1",
                params![format!("%{run_id}%")],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(memory_count, 1);
    }

    #[test]
    fn remote_commands_are_scoped_to_the_paired_profile() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let timestamp = now();
        let other_profile = new_id();
        let other_portfolio = new_id();
        let other_run = new_id();
        db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at)
                 VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile, timestamp],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO portfolios(id, profile_id, name, base_currency, benchmark_id, risk_profile, created_at, updated_at)
                 VALUES (?1, ?2, 'Other Portfolio', 'USD', NULL, '{}', ?3, ?3)",
                params![other_portfolio, other_profile, timestamp],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO research_runs(id, profile_id, portfolio_id, status, user_request, selected_team, codex_thread_id, workspace_path, custom_agent_versions, local_tool_config_hash, model_config, started_at)
                 VALUES (?1, ?2, ?3, 'completed', 'Other run', 'portfolio_review_committee', 'thread-other', 'runs/other', '{}', 'hash', '{}', ?4)",
                params![other_run, other_profile, other_portfolio, timestamp],
            )
            .unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            "public-key",
            &["portfolio", "run"],
        )
        .unwrap();

        let listed = execute_authorized_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-list".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: None,
                command_type: "portfolio.list".to_string(),
                payload: json!({"profileId": other_profile}),
            },
        )
        .unwrap();
        assert!(listed
            .data
            .as_array()
            .unwrap()
            .iter()
            .all(|portfolio| { portfolio["profileId"] == json!(MVP_PROFILE_ID) }));

        let denied = execute_authorized_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-run-get".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: None,
                command_type: "run.get".to_string(),
                payload: json!({"runId": other_run}),
            },
        );
        assert!(denied.is_err());
    }

    #[test]
    fn sensitive_commands_require_biometric_unlock_and_session_key_reference() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            "public-key",
            &["run"],
        )
        .unwrap();

        let missing_key_ref = authorize_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-missing-key".to_string(),
                session_id: session.id.clone(),
                session_key_ref: None,
                unlock: None,
                command_type: "run.start".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert!(missing_key_ref
            .warnings
            .contains(&"invalid_session_key_ref".to_string()));

        let locked = authorize_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-locked".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: None,
                command_type: "run.start".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert!(locked.warnings.contains(&"unlock_required".to_string()));

        let unlocked = authorize_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-unlocked".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: Some(RemoteUnlockProof {
                    method: "biometric".to_string(),
                    session_key_ref: session.session_key_ref.clone(),
                    challenge: unlock_challenge(&session.id, "cmd-unlocked"),
                }),
                command_type: "run.start".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert!(unlocked.permission_granted);
    }

    #[test]
    fn sensitive_read_commands_require_unlock() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            "public-key",
            &["artifact", "wiki"],
        )
        .unwrap();

        for command_type in ["artifact.get", "wiki.get"] {
            let locked = authorize_remote_command(
                &db,
                &RemoteCommandRequest {
                    command_id: format!("cmd-{command_type}"),
                    session_id: session.id.clone(),
                    session_key_ref: Some(session.session_key_ref.clone()),
                    unlock: None,
                    command_type: command_type.to_string(),
                    payload: json!({}),
                },
            )
            .unwrap();
            assert!(
                locked.warnings.contains(&"unlock_required".to_string()),
                "{command_type} should require unlock"
            );
        }
    }

    #[test]
    fn executes_memory_and_wiki_activity_with_correct_fields() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let timestamp = now();
        let memory_id = new_id();
        db.conn
            .execute(
                "INSERT INTO memory_records(id, profile_id, mem0_id, kind, summary, tags, source_refs, capture_policy, sensitivity_class, retention_class, status, created_at, updated_at)
                 VALUES (?1, ?2, NULL, 'preference', 'Local only memory', '[]', '[]', 'manual', 'normal', 'default', 'active', ?3, ?3)",
                params![memory_id, MVP_PROFILE_ID, timestamp],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO memory_activity(id, memory_id, event_type, actor, research_run_id, audit_ref, payload, created_at)
                 VALUES (?1, ?2, 'memory.captured', 'user', NULL, NULL, '{\"ok\":true}', ?3)",
                params![new_id(), memory_id, timestamp],
            )
            .unwrap();
        let wiki_id = new_id();
        let revision_id = new_id();
        db.conn
            .execute(
                "INSERT INTO wiki_pages(id, profile_id, slug, category, title, summary, status, current_revision_id, tags, source_refs, memory_refs, freshness, confidence, created_at, updated_at)
                 VALUES (?1, ?2, 'btc-risk', 'risk_lesson', 'BTC Risk', 'Risk note', 'active', ?3, '[]', '[]', '[]', 'current', 'medium', ?4, ?4)",
                params![wiki_id, MVP_PROFILE_ID, revision_id, timestamp],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
                 VALUES (?1, ?2, 1, 'wiki/btc.md', 'hash', 'Initial note', '[]', '[]', 'user', NULL, ?3)",
                params![revision_id, wiki_id, timestamp],
            )
            .unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            "public-key",
            &["memory", "wiki"],
        )
        .unwrap();

        let memory_activity = execute_authorized_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-memory".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: None,
                command_type: "memory.activity".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert_eq!(memory_activity.data[0]["createdAt"], timestamp);

        let wiki_activity = execute_authorized_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-wiki".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: None,
                command_type: "wiki.listActivity".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert_eq!(wiki_activity.data[0]["createdAt"], timestamp);
        assert_eq!(
            wiki_activity.data[0]["payload"]["revisionNote"],
            "Initial note"
        );

        execute_authorized_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-archive".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: Some(RemoteUnlockProof {
                    method: "biometric".to_string(),
                    session_key_ref: session.session_key_ref.clone(),
                    challenge: unlock_challenge(&session.id, "cmd-archive"),
                }),
                command_type: "memory.archive".to_string(),
                payload: json!({"memoryId": memory_id}),
            },
        )
        .unwrap();
        let status: String = db
            .conn
            .query_row(
                "SELECT status FROM memory_records WHERE id = ?1",
                params![memory_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "archived");

        execute_authorized_remote_command(
            &db,
            &RemoteCommandRequest {
                command_id: "cmd-forget".to_string(),
                session_id: session.id.clone(),
                session_key_ref: Some(session.session_key_ref.clone()),
                unlock: Some(RemoteUnlockProof {
                    method: "biometric".to_string(),
                    session_key_ref: session.session_key_ref.clone(),
                    challenge: unlock_challenge(&session.id, "cmd-forget"),
                }),
                command_type: "memory.forget".to_string(),
                payload: json!({"memoryId": memory_id}),
            },
        )
        .unwrap();
        let (status, deleted_at): (String, Option<String>) = db
            .conn
            .query_row(
                "SELECT status, deleted_at FROM memory_records WHERE id = ?1",
                params![memory_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(status, "deleted");
        assert!(deleted_at.is_some());
    }
}
