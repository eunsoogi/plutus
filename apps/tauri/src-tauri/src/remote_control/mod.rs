use anyhow::{bail, Context, Result};
use rand::RngCore;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::audit::record_audit_event;
use crate::storage::{new_id, now, PlutusDatabase, MVP_PROFILE_ID};

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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteCommandRequest {
    pub command_id: String,
    pub session_id: String,
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
    if !matches!(device_platform, "ios" | "android") {
        bail!("unsupported remote device platform");
    }
    let device_id = new_id();
    let session_id = new_id();
    let key_ref = format!("secure://remote-session/{session_id}");
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
         VALUES (?1, ?2, 'connected', 'plutus.local:7420', ?3, ?4, ?4)",
        params![session_id, device_id, key_ref, now()],
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
        host_address: "plutus.local:7420".to_string(),
        session_key_ref: key_ref,
    })
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

pub fn mark_session_stale(db: &PlutusDatabase, session_id: &str) -> Result<()> {
    db.conn.execute(
        "UPDATE remote_sessions SET status = 'stale' WHERE id = ?1",
        params![session_id],
    )?;
    Ok(())
}

pub fn authorize_remote_command(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
) -> Result<RemoteCommandResponse> {
    let row = db
        .conn
        .query_row(
            "SELECT s.status, d.revoked_at, d.permissions, d.profile_id, d.id
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
                ))
            },
        )
        .optional()?
        .context("remote session not found")?;

    let (status, revoked_at, permissions, profile_id, device_id) = row;
    let mut warnings = Vec::new();
    if status != "connected" {
        warnings.push(format!("session_{status}"));
    }
    if revoked_at.is_some() {
        warnings.push("device_revoked".to_string());
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

pub fn command_group(command_type: &str) -> &str {
    command_type.split('.').next().unwrap_or("unknown")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::PlutusDatabase;

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
                command_type: "portfolio.list".to_string(),
                payload: json!({}),
            },
        )
        .unwrap();
        assert!(revoked.warnings.contains(&"device_revoked".to_string()));
    }
}
