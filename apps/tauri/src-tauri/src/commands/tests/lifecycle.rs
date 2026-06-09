use super::*;

#[test]
fn command_layer_persists_portfolios_runs_and_artifacts() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let commands = PlutusCommands::new(&db);
    let portfolio = commands
        .create_portfolio(CreatePortfolioInput {
            profile_id: MVP_PROFILE_ID.to_string(),
            name: "Command Portfolio".to_string(),
            base_currency: "USD".to_string(),
        })
        .unwrap();
    assert_eq!(portfolio.name, "Command Portfolio");

    let run = commands
        .start_research_run(StartResearchRunInput {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Review BTC/NVDA with api_key sk-secret".to_string(),
            selected_team: None,
        })
        .unwrap();
    assert!(!run.user_request.contains("sk-secret"));
    let artifact_id = seed_run_artifact(&db, &run.id).unwrap();
    assert_eq!(
        commands.get_artifact(&artifact_id).unwrap().artifact_type,
        "run_card"
    );
    commands
        .cancel_research_run(&run.id, MVP_PROFILE_ID)
        .unwrap();
    assert_eq!(
        commands.get_research_run(&run.id).unwrap().status,
        "completed"
    );
}

#[test]
fn start_run_persists_resumable_runtime_bridge_metadata_and_event() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut db = PlutusDatabase::open(&paths.database).unwrap();
    db.seed_mvp().unwrap();
    let commands = PlutusCommands::new_with_paths(&db, &paths);

    let run = commands
        .start_research_run(StartResearchRunInput {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Review BTC/NVDA".to_string(),
            selected_team: None,
        })
        .unwrap();

    assert!(run
        .codex_thread_id
        .as_deref()
        .unwrap()
        .starts_with("codex-thread-"));
    assert_eq!(
        run.workspace_path,
        paths.run_workspaces.join(&run.id).display().to_string()
    );
    assert!(paths.run_workspaces.join(&run.id).exists());
    let (config_hash, model_config): (String, String) = db
        .conn
        .query_row(
            "SELECT local_tool_config_hash, model_config FROM research_runs WHERE id = ?1",
            [&run.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(config_hash.len(), 64);
    assert!(model_config.contains("codex_sdk_run_host"));
    let event_type: String = db
            .conn
            .query_row(
                "SELECT event_type FROM research_run_events WHERE research_run_id = ?1 AND sequence = 1",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
    assert_eq!(event_type, "codex_run_host.started");
    assert!(paths.root.join("local-tools/portfolio-state.json").exists());
    let memory_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM memory_records WHERE kind = 'risk_warning' AND source_refs LIKE ?1",
                [format!("%{}%", run.id)],
                |row| row.get(0),
            )
            .unwrap();
    assert!(memory_count > 0);
    let wiki_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM wiki_pages WHERE title = 'BTC/NVDA risk review'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert!(wiki_count > 0);
}

#[test]
fn cancel_run_is_scoped_to_active_profile() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let timestamp = now();
    let other_profile_id = "018f3f5d-0000-7000-8000-444444444444";
    db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile_id, timestamp],
            )
            .unwrap();
    let run = db
        .create_research_run(NewResearchRun {
            profile_id: other_profile_id.to_string(),
            portfolio_id: None,
            user_request: "Other profile review".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    let commands = PlutusCommands::new(&db);

    let rejected = commands.cancel_research_run(&run.id, MVP_PROFILE_ID);
    assert!(rejected
        .unwrap_err()
        .to_string()
        .contains("outside active profile"));
    assert_eq!(commands.get_research_run(&run.id).unwrap().status, "queued");
}

#[test]
fn command_surface_blocks_trade_tools() {
    let db = PlutusDatabase::in_memory().unwrap();
    let commands = PlutusCommands::new(&db);
    assert!(commands
        .assert_command_surface_safe("trade.place_order")
        .is_err());
    assert!(commands
        .assert_command_surface_safe("researchRuns.start")
        .is_ok());
}
