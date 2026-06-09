use crate::remote_control::*;
use crate::storage::{new_id, PlutusDatabase, MVP_PROFILE_ID};
use rusqlite::params;
use serde_json::json;

#[test]
fn executes_authorized_remote_command_with_data_timestamp_and_audit() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let session = pair_device(
        &db,
        MVP_PROFILE_ID,
        "Eunsoo iPhone",
        "ios",
        &test_remote_public_key(),
        &["portfolios"],
    )
    .unwrap();

    let response = execute_authorized_remote_command(
        &db,
        None,
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
        &test_remote_public_key(),
        &["run"],
    )
    .unwrap();
    let response = execute_authorized_remote_command(
        &db,
        None,
        &RemoteCommandRequest {
            command_id: "cmd-remote-run".to_string(),
            session_id: session.id.clone(),
            session_key_ref: Some(session.session_key_ref.clone()),
            unlock: Some(RemoteUnlockProof {
                method: "biometric".to_string(),
                session_key_ref: session.session_key_ref.clone(),
                challenge: Some(test_unlock_challenge(
                    &session.id,
                    "cmd-remote-run",
                    &session.session_key_ref,
                    "run.start",
                    &json!({"profileId": MVP_PROFILE_ID, "userRequest": "Remote review"}),
                )),
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
