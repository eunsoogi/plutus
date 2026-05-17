use anyhow::Result;
use rusqlite::params;
use sha2::{Digest, Sha256};

use crate::storage::{new_id, now, PlutusDatabase};

pub fn hash_payload(payload: &serde_json::Value) -> String {
    let mut hasher = Sha256::new();
    hasher.update(payload.to_string().as_bytes());
    hex::encode(hasher.finalize())
}

pub fn record_audit_event(
    db: &PlutusDatabase,
    profile_id: Option<&str>,
    research_run_id: Option<&str>,
    actor: &str,
    action: &str,
    target_ref: &str,
    payload: &serde_json::Value,
) -> Result<String> {
    let id = new_id();
    db.conn.execute(
        "INSERT INTO audit_events(id, profile_id, research_run_id, actor, action, target_ref, payload_hash, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            profile_id,
            research_run_id,
            actor,
            action,
            target_ref,
            hash_payload(payload),
            now()
        ],
    )?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::storage::{PlutusDatabase, MVP_PROFILE_ID};

    #[test]
    fn records_hashed_audit_events_without_raw_payload() {
        let db = PlutusDatabase::in_memory().unwrap();
        let id = record_audit_event(
            &db,
            Some(MVP_PROFILE_ID),
            None,
            "user",
            "portfolio.create",
            "portfolio:new",
            &json!({"secret": "not stored raw"}),
        )
        .unwrap();
        let stored_hash: String = db
            .conn
            .query_row(
                "SELECT payload_hash FROM audit_events WHERE id = ?1",
                [id],
                |row| row.get(0),
            )
            .unwrap();
        assert_ne!(stored_hash, "{\"secret\":\"not stored raw\"}");
        assert_eq!(stored_hash.len(), 64);
    }
}
