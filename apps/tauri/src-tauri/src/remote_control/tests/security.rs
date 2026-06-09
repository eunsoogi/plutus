use crate::remote_control::*;
use crate::storage::{PlutusDatabase, MVP_PROFILE_ID};
use serde_json::json;

#[test]
fn sensitive_commands_require_biometric_unlock_and_session_key_reference() {
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
                challenge: Some(test_unlock_challenge(
                    &session.id,
                    "cmd-unlocked",
                    &session.session_key_ref,
                    "run.start",
                    &json!({}),
                )),
            }),
            command_type: "run.start".to_string(),
            payload: json!({}),
        },
    )
    .unwrap();
    assert!(unlocked.permission_granted);
}

#[test]
fn sensitive_unlock_proofs_are_bound_to_payload_and_single_use() {
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
    let payload = json!({"profileId": MVP_PROFILE_ID, "userRequest": "Remote review"});
    let challenge = test_unlock_challenge(
        &session.id,
        "cmd-bound-run",
        &session.session_key_ref,
        "run.start",
        &payload,
    );

    let substituted = authorize_remote_command(
        &db,
        &RemoteCommandRequest {
            command_id: "cmd-bound-run".to_string(),
            session_id: session.id.clone(),
            session_key_ref: Some(session.session_key_ref.clone()),
            unlock: Some(RemoteUnlockProof {
                method: "biometric".to_string(),
                session_key_ref: session.session_key_ref.clone(),
                challenge: Some(challenge.clone()),
            }),
            command_type: "run.start".to_string(),
            payload: json!({"profileId": MVP_PROFILE_ID, "userRequest": "Different review"}),
        },
    )
    .unwrap();
    assert!(substituted
        .warnings
        .contains(&"unlock_required".to_string()));

    let request = RemoteCommandRequest {
        command_id: "cmd-bound-run".to_string(),
        session_id: session.id.clone(),
        session_key_ref: Some(session.session_key_ref.clone()),
        unlock: Some(RemoteUnlockProof {
            method: "biometric".to_string(),
            session_key_ref: session.session_key_ref.clone(),
            challenge: Some(challenge),
        }),
        command_type: "run.start".to_string(),
        payload,
    };
    let first = execute_authorized_remote_command(&db, None, &request).unwrap();
    assert!(first.authorization.permission_granted);
    let replay = execute_authorized_remote_command(&db, None, &request).unwrap_err();
    assert!(replay
        .to_string()
        .contains("remote command nonce has already been consumed"));
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
        &test_remote_public_key(),
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
