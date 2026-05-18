use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::audit::record_audit_event;
use crate::remote_control::mark_session_stale;
use crate::secure_store::SecureStore;
use crate::storage::{now, PlutusDatabase};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteTransportFrame {
    pub session_id: String,
    pub nonce: String,
    pub ciphertext_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteHeartbeat {
    pub session_id: String,
    pub observed_at: String,
    pub stale: bool,
}

pub struct RemoteTransportService<'a> {
    db: &'a PlutusDatabase,
    session_key_ref: String,
}

impl<'a> RemoteTransportService<'a> {
    pub fn new(db: &'a PlutusDatabase, session_key_ref: impl Into<String>) -> Self {
        Self {
            db,
            session_key_ref: session_key_ref.into(),
        }
    }

    pub fn encrypt_command(&self, session_id: &str, plaintext_json: &str) -> RemoteTransportFrame {
        let nonce = now();
        RemoteTransportFrame {
            session_id: session_id.to_string(),
            ciphertext_hex: hex::encode(xor_with_keystream(
                plaintext_json.as_bytes(),
                &self.session_key_ref,
                &nonce,
            )),
            nonce,
        }
    }

    pub fn decrypt_command(&self, frame: &RemoteTransportFrame) -> Result<String> {
        let bytes = hex::decode(&frame.ciphertext_hex)?;
        let plaintext = xor_with_keystream(&bytes, &self.session_key_ref, &frame.nonce);
        String::from_utf8(plaintext).map_err(Into::into)
    }

    pub fn heartbeat(&self, session_id: &str, missed_intervals: u8) -> Result<RemoteHeartbeat> {
        let stale = missed_intervals >= 3;
        let observed_at = now();
        if stale {
            mark_session_stale(self.db, session_id)?;
        } else {
            self.db.conn.execute(
                "UPDATE remote_sessions SET last_heartbeat_at = ?1 WHERE id = ?2",
                rusqlite::params![observed_at, session_id],
            )?;
        }
        Ok(RemoteHeartbeat {
            session_id: session_id.to_string(),
            observed_at,
            stale,
        })
    }

    pub fn forward_host_event(
        &self,
        session_id: &str,
        event_json: &str,
    ) -> Result<RemoteTransportFrame> {
        if event_json.trim().is_empty() {
            bail!("remote host events must not be empty");
        }
        Ok(self.encrypt_command(session_id, event_json))
    }
}

pub fn forward_event_to_paired_sessions(
    db: &PlutusDatabase,
    secure_root: Option<&Path>,
    profile_id: &str,
    event_json: &str,
) -> Result<usize> {
    let mut stmt = db.conn.prepare(
        "SELECT s.id, s.session_key_ref
         FROM remote_sessions s
         JOIN remote_devices d ON d.id = s.remote_device_id
         WHERE d.profile_id = ?1 AND s.status = 'connected'",
    )?;
    let sessions = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    for (session_id, key_ref) in &sessions {
        let secret = secure_root
            .and_then(|root| SecureStore::read_remote_session_secret(root, key_ref).ok())
            .unwrap_or_else(|| key_ref.clone());
        let service = RemoteTransportService::new(db, secret);
        let frame = service.forward_host_event(session_id, event_json)?;
        record_audit_event(
            db,
            Some(profile_id),
            None,
            "system",
            "remote.event_forwarded",
            session_id,
            &serde_json::json!({
                "nonce": frame.nonce,
                "ciphertextHash": hex::encode(Sha256::digest(frame.ciphertext_hex.as_bytes())),
            }),
        )?;
    }
    Ok(sessions.len())
}

fn xor_with_keystream(input: &[u8], key_ref: &str, nonce: &str) -> Vec<u8> {
    input
        .iter()
        .enumerate()
        .map(|(index, byte)| {
            let mut hasher = Sha256::new();
            hasher.update(key_ref.as_bytes());
            hasher.update(nonce.as_bytes());
            hasher.update(index.to_le_bytes());
            let digest = hasher.finalize();
            byte ^ digest[0]
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote_control::{pair_device, test_remote_public_key};
    use crate::storage::{PlutusDatabase, MVP_PROFILE_ID};

    #[test]
    fn encrypts_forwards_heartbeats_and_marks_stale_sessions() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            &test_remote_public_key(),
            &["run"],
        )
        .unwrap();
        let temp = tempfile::tempdir().unwrap();
        let key_ref = SecureStore::create_remote_session_key(temp.path(), &session.id).unwrap();
        let secret = SecureStore::read_remote_session_secret(temp.path(), &key_ref).unwrap();
        let transport = RemoteTransportService::new(&db, secret);
        let frame = transport
            .forward_host_event(&session.id, "{\"type\":\"run.completed\"}")
            .unwrap();
        assert_ne!(frame.ciphertext_hex, "{\"type\":\"run.completed\"}");
        assert_eq!(
            transport.decrypt_command(&frame).unwrap(),
            "{\"type\":\"run.completed\"}"
        );

        let heartbeat = transport.heartbeat(&session.id, 3).unwrap();
        assert!(heartbeat.stale);
        let status: String = db
            .conn
            .query_row(
                "SELECT status FROM remote_sessions WHERE id = ?1",
                [&session.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "stale");
    }

    #[test]
    fn forwards_events_to_connected_profile_sessions() {
        let mut db = PlutusDatabase::in_memory().unwrap();
        db.seed_mvp().unwrap();
        let session = pair_device(
            &db,
            MVP_PROFILE_ID,
            "Eunsoo iPhone",
            "ios",
            &test_remote_public_key(),
            &["run"],
        )
        .unwrap();
        let temp = tempfile::tempdir().unwrap();
        SecureStore::create_remote_session_key(temp.path(), &session.id).unwrap();

        let forwarded = forward_event_to_paired_sessions(
            &db,
            Some(temp.path()),
            MVP_PROFILE_ID,
            "{\"type\":\"run.completed\"}",
        )
        .unwrap();
        assert_eq!(forwarded, 1);
        let count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM audit_events WHERE action = 'remote.event_forwarded'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}
