use super::*;

#[test]
fn runtime_stream_consumer_persists_events_and_final_output_for_spawned_runs() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut db = PlutusDatabase::open(&paths.database).unwrap();
    db.seed_mvp().unwrap();
    let run = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Stream runtime output".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    db.conn
        .execute(
            "UPDATE research_runs SET status = 'running' WHERE id = ?1",
            params![run.id],
        )
        .unwrap();
    fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
    let final_card = {
        let mut card = valid_final_card("Spawned runtime card", "risk_warning");
        card["category"] = json!("risk_warning");
        card["riskValidation"] = json!("vetoed");
        card
    };
    let stream = format!(
        "{}\n{}\n{}\n",
        json!({"type": "started", "threadId": "codex-thread-real"}),
        json!({"type": "event", "event": {"type": "run.stage_started", "stage": "planning", "runId": run.id}}),
        json!({"type": "finalOutput", "finalOutput": final_card})
    );

    spawn_codex_runtime_stream_consumer(
        run.id.clone(),
        paths.clone(),
        std::io::Cursor::new(stream.into_bytes()),
        None::<std::io::Cursor<Vec<u8>>>,
        spawn_finished_child(0),
    );

    let reopened = PlutusDatabase::open(&paths.database).unwrap();
    for _ in 0..50 {
        let count: i64 = reopened
            .conn
            .query_row(
                "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
        if count == 1 {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    let (status, thread_id): (String, Option<String>) = reopened
        .conn
        .query_row(
            "SELECT status, codex_thread_id FROM research_runs WHERE id = ?1",
            params![run.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(status, "completed");
    assert_eq!(thread_id, Some("codex-thread-real".to_string()));
    let event_count: i64 = reopened
            .conn
            .query_row(
                "SELECT COUNT(*) FROM research_run_events WHERE research_run_id = ?1 AND event_type = 'run.stage_started'",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
    assert_eq!(event_count, 1);
}

#[test]
fn runtime_stream_consumer_ignores_spoofed_run_ids_inside_stream() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut db = PlutusDatabase::open(&paths.database).unwrap();
    db.seed_mvp().unwrap();
    let run = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Primary run".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    let other_run = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Other run".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
    let mut final_card = valid_final_card("Spoofed stream card", "risk_warning");
    final_card["runId"] = json!(other_run.id);
    final_card["category"] = json!("risk_warning");
    final_card["riskValidation"] = json!("vetoed");
    let stream = format!(
        "{}\n{}\n",
        json!({"type": "event", "event": {"type": "run.stage_started", "stage": "planning", "runId": other_run.id}}),
        json!({"type": "finalOutput", "finalOutput": final_card})
    );
    spawn_codex_runtime_stream_consumer(
        run.id.clone(),
        paths.clone(),
        std::io::Cursor::new(stream.into_bytes()),
        None::<std::io::Cursor<Vec<u8>>>,
        spawn_finished_child(0),
    );
    let reopened = PlutusDatabase::open(&paths.database).unwrap();
    for _ in 0..50 {
        let count: i64 = reopened
            .conn
            .query_row(
                "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
        if count == 1 {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    let primary_outputs: i64 = reopened
        .conn
        .query_row(
            "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
            params![run.id],
            |row| row.get(0),
        )
        .unwrap();
    let other_outputs: i64 = reopened
        .conn
        .query_row(
            "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
            params![other_run.id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(primary_outputs, 1);
    assert_eq!(other_outputs, 0);
    let structured_output: String = reopened
        .conn
        .query_row(
            "SELECT structured_output FROM research_run_final_outputs WHERE research_run_id = ?1",
            params![run.id],
            |row| row.get(0),
        )
        .unwrap();
    let structured_output = serde_json::from_str::<Value>(&structured_output).unwrap();
    assert_eq!(structured_output["runId"], run.id);
    assert_eq!(structured_output["profileId"], MVP_PROFILE_ID);
    let event_payload: String = reopened
            .conn
            .query_row(
                "SELECT payload FROM research_run_events WHERE research_run_id = ?1 AND event_type = 'run.stage_started'",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
    let event_payload = serde_json::from_str::<Value>(&event_payload).unwrap();
    assert_eq!(event_payload["runId"], run.id);
    assert_eq!(event_payload["profileId"], MVP_PROFILE_ID);
}

#[test]
fn runtime_stream_consumer_preserves_final_output_validation_error() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut db = PlutusDatabase::open(&paths.database).unwrap();
    db.seed_mvp().unwrap();
    let run = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Invalid stream output".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    db.conn
        .execute(
            "UPDATE research_runs SET status = 'running' WHERE id = ?1",
            params![run.id],
        )
        .unwrap();
    fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
    let mut final_card = valid_final_card("Invalid stream card", "risk_warning");
    final_card["recommendationCategory"] = json!("trade_now");
    let stream = format!(
        "{}\n",
        json!({"type": "finalOutput", "finalOutput": final_card})
    );
    spawn_codex_runtime_stream_consumer(
        run.id.clone(),
        paths.clone(),
        std::io::Cursor::new(stream.into_bytes()),
        None::<std::io::Cursor<Vec<u8>>>,
        spawn_finished_child(0),
    );
    let reopened = PlutusDatabase::open(&paths.database).unwrap();
    for _ in 0..50 {
        let reason: Option<String> = reopened
            .conn
            .query_row(
                "SELECT failure_reason FROM research_runs WHERE id = ?1",
                params![run.id],
                |row| row.get(0),
            )
            .unwrap();
        if reason.is_some() {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    let failure_reason: String = reopened
        .conn
        .query_row(
            "SELECT failure_reason FROM research_runs WHERE id = ?1",
            params![run.id],
            |row| row.get(0),
        )
        .unwrap();
    assert!(failure_reason.contains("invalid recommendation category"));
}
