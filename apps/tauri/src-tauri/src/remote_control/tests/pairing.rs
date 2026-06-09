use crate::remote_control::*;
use crate::storage::{new_id, PlutusDatabase, MVP_PROFILE_ID};
use serde_json::json;

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
        &test_remote_public_key(),
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
        &test_remote_public_key(),
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
        &test_remote_public_key(),
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
        &test_remote_public_key(),
        &["portfolio"],
    );
    assert!(blocked_pairing
        .unwrap_err()
        .to_string()
        .contains("remote control host kill switch is active"));
}
