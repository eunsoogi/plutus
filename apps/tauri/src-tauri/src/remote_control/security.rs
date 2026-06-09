use anyhow::{bail, Result};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rusqlite::params;

use crate::storage::{now, sha256_hex, PlutusDatabase};

use super::types::{RemoteCommandRequest, RemoteUnlockProof};

pub(super) fn unlock_message(
    session_id: &str,
    command_id: &str,
    session_key_ref: &str,
    command_type: &str,
    payload: &serde_json::Value,
) -> String {
    let payload_hash = sha256_hex(payload.to_string().as_bytes());
    format!(
        "plutus.remote_unlock.v1:{session_id}:{command_id}:{session_key_ref}:{command_type}:{payload_hash}"
    )
}

fn ensure_remote_command_nonce_table(db: &PlutusDatabase) -> Result<()> {
    db.conn.execute(
        "CREATE TABLE IF NOT EXISTS remote_command_nonces(
            session_id TEXT NOT NULL,
            command_id TEXT NOT NULL,
            command_type TEXT NOT NULL,
            payload_hash TEXT NOT NULL,
            consumed_at TEXT NOT NULL,
            PRIMARY KEY(session_id, command_id)
        )",
        [],
    )?;
    Ok(())
}

pub(super) fn consume_remote_command_nonce(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
) -> Result<()> {
    ensure_remote_command_nonce_table(db)?;
    let inserted = db.conn.execute(
        "INSERT OR IGNORE INTO remote_command_nonces(session_id, command_id, command_type, payload_hash, consumed_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            &request.session_id,
            &request.command_id,
            &request.command_type,
            sha256_hex(request.payload.to_string().as_bytes()),
            now()
        ],
    )?;
    if inserted == 0 {
        bail!("remote command nonce has already been consumed");
    }
    Ok(())
}

pub fn command_group(command_type: &str) -> &str {
    command_type.split('.').next().unwrap_or("unknown")
}

pub(super) fn valid_unlock_proof(
    db: &PlutusDatabase,
    proof: Option<&RemoteUnlockProof>,
    session_id: &str,
    command_id: &str,
    session_key_ref: &str,
    command_type: &str,
    payload: &serde_json::Value,
) -> bool {
    let Some(proof) = proof else {
        return false;
    };
    if proof.method != "biometric" || proof.session_key_ref != session_key_ref {
        return false;
    }
    let Some(signature_hex) = proof
        .challenge
        .as_deref()
        .and_then(|challenge| challenge.strip_prefix("ed25519:"))
    else {
        return false;
    };
    let Ok(public_key_hex) = db.conn.query_row(
        "SELECT d.public_key
         FROM remote_sessions s
         JOIN remote_devices d ON d.id = s.remote_device_id
         WHERE s.id = ?1 AND s.session_key_ref = ?2",
        params![session_id, session_key_ref],
        |row| row.get::<_, String>(0),
    ) else {
        return false;
    };
    let Some(public_key_hex) = public_key_hex.strip_prefix("ed25519:") else {
        return false;
    };
    let Ok(public_key_bytes) = hex::decode(public_key_hex) else {
        return false;
    };
    let Ok(signature_bytes) = hex::decode(signature_hex) else {
        return false;
    };
    let Ok(public_key_array) = <[u8; 32]>::try_from(public_key_bytes.as_slice()) else {
        return false;
    };
    let Ok(signature_array) = <[u8; 64]>::try_from(signature_bytes.as_slice()) else {
        return false;
    };
    let Ok(verifying_key) = VerifyingKey::from_bytes(&public_key_array) else {
        return false;
    };
    let signature = Signature::from_bytes(&signature_array);
    verifying_key
        .verify(
            unlock_message(
                session_id,
                command_id,
                session_key_ref,
                command_type,
                payload,
            )
            .as_bytes(),
            &signature,
        )
        .is_ok()
}

pub(super) fn command_requires_unlock(command_type: &str) -> bool {
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
