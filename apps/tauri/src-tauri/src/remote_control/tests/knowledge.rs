use crate::remote_control::*;
use crate::storage::{new_id, now, PlutusDatabase, MVP_PROFILE_ID};
use rusqlite::params;
use serde_json::json;

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
             VALUES (?1, ?2, 'memory.captured', 'user', NULL, NULL, '{\"ok\":true,\"note\":\"broker token sk-remote-secret\"}', ?3)",
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
        &test_remote_public_key(),
        &["memory", "wiki"],
    )
    .unwrap();

    let memory_activity = execute_authorized_remote_command(
        &db,
        None,
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
    assert_eq!(memory_activity.data[0]["payload"]["ok"], true);
    assert!(!memory_activity.data[0]["payload"]
        .to_string()
        .contains("sk-remote-secret"));

    let wiki_activity = execute_authorized_remote_command(
        &db,
        None,
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

    let denied_archive = execute_authorized_remote_command(
        &db,
        None,
        &RemoteCommandRequest {
            command_id: "cmd-archive".to_string(),
            session_id: session.id.clone(),
            session_key_ref: Some(session.session_key_ref.clone()),
            unlock: Some(RemoteUnlockProof {
                method: "biometric".to_string(),
                session_key_ref: session.session_key_ref.clone(),
                challenge: Some(test_unlock_challenge(
                    &session.id,
                    "cmd-archive",
                    &session.session_key_ref,
                    "memory.archive",
                    &json!({"memoryId": memory_id}),
                )),
            }),
            command_type: "memory.archive".to_string(),
            payload: json!({"memoryId": memory_id}),
        },
    );
    assert!(denied_archive
        .unwrap_err()
        .to_string()
        .contains("memory mutations are Mac-host only"));
    let status: String = db
        .conn
        .query_row(
            "SELECT status FROM memory_records WHERE id = ?1",
            params![memory_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(status, "active");

    let denied_forget = execute_authorized_remote_command(
        &db,
        None,
        &RemoteCommandRequest {
            command_id: "cmd-forget".to_string(),
            session_id: session.id.clone(),
            session_key_ref: Some(session.session_key_ref.clone()),
            unlock: Some(RemoteUnlockProof {
                method: "biometric".to_string(),
                session_key_ref: session.session_key_ref.clone(),
                challenge: Some(test_unlock_challenge(
                    &session.id,
                    "cmd-forget",
                    &session.session_key_ref,
                    "memory.forget",
                    &json!({"memoryId": memory_id}),
                )),
            }),
            command_type: "memory.forget".to_string(),
            payload: json!({"memoryId": memory_id}),
        },
    );
    assert!(denied_forget
        .unwrap_err()
        .to_string()
        .contains("memory mutations are Mac-host only"));
    let (status, deleted_at): (String, Option<String>) = db
        .conn
        .query_row(
            "SELECT status, deleted_at FROM memory_records WHERE id = ?1",
            params![memory_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(status, "active");
    assert!(deleted_at.is_none());
}
