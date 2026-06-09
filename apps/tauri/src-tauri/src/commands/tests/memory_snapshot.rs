use super::*;

#[test]
fn memory_delete_and_wiki_revert_follow_domain_lifecycle_semantics() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let commands = PlutusCommands::new(&db);
    let timestamp = now();
    let memory_id = new_id();
    db.conn
            .execute(
                "INSERT INTO memory_records(id, profile_id, mem0_id, kind, summary, tags, source_refs, capture_policy, sensitivity_class, retention_class, status, created_at, updated_at)
                 VALUES (?1, ?2, NULL, 'research_memory', 'Deletion test memory', '[]', '[]', 'manual', 'normal', 'default', 'active', ?3, ?3)",
                params![memory_id, MVP_PROFILE_ID, timestamp],
            )
            .unwrap();
    commands
        .archive_memory(&memory_id, MVP_PROFILE_ID, "old lesson")
        .unwrap();
    let (archived_status, archived_retention): (String, String) = db
        .conn
        .query_row(
            "SELECT status, retention_class FROM memory_records WHERE id = ?1",
            params![memory_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(archived_status, "archived");
    assert_eq!(archived_retention, "archived");
    commands.forget_memory(&memory_id, MVP_PROFILE_ID).unwrap();
    let (deleted_status, deleted_at): (String, Option<String>) = db
        .conn
        .query_row(
            "SELECT status, deleted_at FROM memory_records WHERE id = ?1",
            params![memory_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(deleted_status, "deleted");
    assert!(deleted_at.is_some());

    let other_profile_id = "018f3f5d-0000-7000-8000-555555555555";
    db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile_id, timestamp],
            )
            .unwrap();
    let other_memory_id = new_id();
    db.conn
            .execute(
                "INSERT INTO memory_records(id, profile_id, mem0_id, kind, summary, tags, source_refs, capture_policy, sensitivity_class, retention_class, status, created_at, updated_at)
                 VALUES (?1, ?2, NULL, 'research_memory', 'Other profile memory', '[]', '[]', 'manual', 'normal', 'default', 'active', ?3, ?3)",
                params![other_memory_id, other_profile_id, timestamp],
            )
            .unwrap();
    assert!(commands
        .archive_memory(&other_memory_id, MVP_PROFILE_ID, "wrong profile")
        .unwrap_err()
        .to_string()
        .contains("memory outside active profile"));

    let wiki_id = new_id();
    let original_revision_id = new_id();
    let current_revision_id = new_id();
    db.conn
            .execute(
                "INSERT INTO wiki_pages(id, profile_id, slug, category, title, summary, status, current_revision_id, tags, source_refs, memory_refs, freshness, confidence, created_at, updated_at)
                 VALUES (?1, ?2, 'revert-risk', 'risk_lesson', 'Revert Risk', 'Risk note', 'active', ?3, '[]', '[]', '[]', 'current', 'medium', ?4, ?4)",
                params![wiki_id, MVP_PROFILE_ID, current_revision_id, timestamp],
            )
            .unwrap();
    db.conn
            .execute(
                "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
                 VALUES (?1, ?2, 1, 'wiki/revert-v1.md', 'hash-v1', 'Original', '[]', '[]', 'agent:llm_wiki_curator', NULL, ?3)",
                params![original_revision_id, wiki_id, timestamp],
            )
            .unwrap();
    db.conn
            .execute(
                "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
                 VALUES (?1, ?2, 2, 'wiki/revert-v2.md', 'hash-v2', 'Update', '[]', '[]', 'agent:llm_wiki_curator', NULL, ?3)",
                params![current_revision_id, wiki_id, timestamp],
            )
            .unwrap();

    let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
    let snapshot_page = snapshot["wikiPages"]
        .as_array()
        .unwrap()
        .iter()
        .find(|page| page["id"].as_str() == Some(wiki_id.as_str()))
        .unwrap();
    assert_eq!(snapshot_page["revisionNote"].as_str(), Some("Update"));

    let page = commands
        .revert_wiki_revision(&wiki_id, &original_revision_id, "restore vetted text")
        .unwrap();
    assert_ne!(page["currentRevisionId"], original_revision_id);
    let (revision_number, content_hash, note): (i64, String, String) = db
        .conn
        .query_row(
            "SELECT revision_number, content_hash, revision_note FROM wiki_revisions WHERE id = ?1",
            params![page["currentRevisionId"].as_str().unwrap()],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(revision_number, 3);
    assert_eq!(content_hash, "hash-v1");
    assert_eq!(note, "Revert: restore vetted text");
}

#[test]
fn app_snapshot_exposes_remote_session_and_requires_remote_unlock_proof() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let session = pair_device(
        &db,
        MVP_PROFILE_ID,
        "Eunsoo iPhone",
        "ios",
        &crate::remote_control::test_remote_public_key(),
        &["run"],
    )
    .unwrap();
    let key_ref =
        SecureStore::create_remote_session_key(&paths.secure_storage, &session.id).unwrap();
    let commands = PlutusCommands::new_with_paths(&db, &paths);

    let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
    let remote = &snapshot["remoteDevices"][0];
    assert!(remote.get("session_id").is_none());
    assert!(remote.get("session_key_ref").is_none());
    assert!(remote.get("unlock_proof").is_none());

    let locked = execute_authorized_remote_command(
        &db,
        Some(&paths),
        &RemoteCommandRequest {
            command_id: "cmd-snapshot-run".to_string(),
            session_id: session.id.clone(),
            session_key_ref: Some(key_ref.clone()),
            unlock: Some(crate::remote_control::RemoteUnlockProof {
                method: "biometric".to_string(),
                session_key_ref: key_ref.clone(),
                challenge: None,
            }),
            command_type: "run.start".to_string(),
            payload: json!({"userRequest": "Remote review"}),
        },
    )
    .unwrap();
    assert!(!locked.authorization.permission_granted);
    assert!(locked
        .authorization
        .warnings
        .contains(&"unlock_required".to_string()));

    let request = RemoteCommandRequest {
        command_id: "cmd-snapshot-run".to_string(),
        session_id: session.id.clone(),
        session_key_ref: Some(key_ref.clone()),
        unlock: Some(crate::remote_control::RemoteUnlockProof {
            method: "biometric".to_string(),
            session_key_ref: key_ref,
            challenge: Some(crate::remote_control::test_unlock_challenge(
                &session.id,
                "cmd-snapshot-run",
                &session.session_key_ref,
                "run.start",
                &json!({"userRequest": "Remote review"}),
            )),
        }),
        command_type: "run.start".to_string(),
        payload: json!({"userRequest": "Remote review"}),
    };
    let response = execute_authorized_remote_command(&db, Some(&paths), &request).unwrap();
    assert!(response.authorization.permission_granted);
}
