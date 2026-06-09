use anyhow::{bail, Context, Result};
use ed25519_dalek::VerifyingKey;
use rand::RngCore;
use rusqlite::{params, OptionalExtension};
use serde_json::json;

use crate::audit::record_audit_event;
use crate::secure_store::remote_session_key_ref;
use crate::storage::{new_id, now, sha256_hex, PlutusDatabase};

use super::types::{
    PairingCode, RemoteAddressMetadata, RemoteDevice, RemoteSession, RemoteSessionSecurity,
};

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
    if !valid_ed25519_public_key(device_public_key_hex(public_key)?) {
        bail!("remote device public key is invalid");
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

fn device_public_key_hex(public_key: &str) -> Result<&str> {
    public_key
        .strip_prefix("ed25519:")
        .context("remote device public key must use ed25519")
}

fn valid_ed25519_public_key(public_key_hex: &str) -> bool {
    let Ok(bytes) = hex::decode(public_key_hex) else {
        return false;
    };
    let Ok(array) = <[u8; 32]>::try_from(bytes.as_slice()) else {
        return false;
    };
    VerifyingKey::from_bytes(&array).is_ok()
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

pub(super) fn host_kill_switch(db: &PlutusDatabase) -> Result<(bool, String)> {
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
        "SELECT d.id, d.profile_id, d.device_name, d.device_platform, d.public_key, d.permissions, d.revoked_at
         FROM remote_devices d
         WHERE d.profile_id = ?1
         ORDER BY d.paired_at DESC",
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
