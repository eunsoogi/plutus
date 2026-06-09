use crate::remote_control::*;
use crate::storage::{new_id, now, PlutusDatabase, MVP_PROFILE_ID};
use rusqlite::params;
use serde_json::json;

#[test]
fn denies_revoked_stale_and_unpermitted_remote_commands() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let session = pair_device(
        &db,
        MVP_PROFILE_ID,
        "Android",
        "android",
        &test_remote_public_key(),
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
        &test_remote_public_key(),
        &["portfolio", "run"],
    )
    .unwrap();

    let listed = execute_authorized_remote_command(
        &db,
        None,
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
        None,
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
