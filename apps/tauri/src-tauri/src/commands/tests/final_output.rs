use super::*;

#[test]
fn final_output_validation_blocks_invalid_categories_and_risk_vetoes_to_no_action() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let run = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Review BTC/NVDA".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    let commands = PlutusCommands::new(&db);

    let invalid = commands.persist_validated_final_output(PersistFinalOutput {
        research_run_id: run.id.clone(),
        summary: "Bad category".to_string(),
        structured_output: {
            let mut card = valid_final_card("Bad category", "risk_warning");
            card["recommendationCategory"] = json!("rebalance");
            card
        },
    });
    assert!(invalid
        .unwrap_err()
        .to_string()
        .contains("invalid recommendation category"));

    let output = commands
        .persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Risk veto blocks action".to_string(),
            structured_output: {
                let mut card = valid_final_card("Risk veto blocks action", "strategy_candidate");
                card["riskValidation"] = json!("vetoed");
                card["riskVeto"] = json!({"reason": "Concentration breach"});
                card["freshness"] = json!({"delayStatus": "realtime"});
                card
            },
        })
        .unwrap();

    assert_eq!(
        output.structured_output["recommendationCategory"],
        "no_action"
    );
    assert_eq!(
        commands
            .get_research_run(&run.id)
            .unwrap()
            .recommendation_category,
        Some("no_action".to_string())
    );
    let audit_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM audit_events WHERE research_run_id = ?1 AND action = 'research_run.final_output'",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
    assert_eq!(audit_count, 1);
    let artifact_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM agent_artifacts WHERE research_run_id = ?1",
            [&run.id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(artifact_count, 0);
    let memory_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM memory_records WHERE profile_id = ?1",
            [MVP_PROFILE_ID],
            |row| row.get(0),
        )
        .unwrap();
    let wiki_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM wiki_pages WHERE profile_id = ?1",
            [MVP_PROFILE_ID],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(memory_count, 1);
    assert_eq!(wiki_count, 1);
}

#[test]
fn final_output_rejects_missing_artifact_refs() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let run = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Review BTC/NVDA".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    let commands = PlutusCommands::new(&db);

    let missing = commands.persist_validated_final_output(PersistFinalOutput {
        research_run_id: run.id.clone(),
        summary: "Missing artifact".to_string(),
        structured_output: {
            let mut card = valid_final_card("Missing artifact", "risk_warning");
            card["artifactRefs"] = json!(["missing-run-card"]);
            card
        },
    });

    assert!(missing
        .unwrap_err()
        .to_string()
        .contains("final output artifactRef not found"));
    assert_ne!(
        commands.get_research_run(&run.id).unwrap().status,
        "completed"
    );
}

#[test]
fn final_output_accepts_tool_artifact_refs_with_workspace_paths() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let run = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Review BTC/NVDA".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    let workspace = paths.run_workspaces.join(&run.id);
    fs::create_dir_all(workspace.join("reports")).unwrap();
    fs::write(workspace.join("reports/run-card.json"), br#"{"ok":true}"#).unwrap();
    let commands = PlutusCommands::new_with_paths(&db, &paths);

    commands
        .persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Path artifact".to_string(),
            structured_output: {
                let mut card = valid_final_card("Path artifact", "risk_warning");
                card["artifactRefs"] = json!(["report-json"]);
                card["artifacts"] = json!([
                    {
                        "artifactId": "report-json",
                        "type": "run_card",
                        "title": "Report JSON",
                        "path": "reports/run-card.json"
                    }
                ]);
                card
            },
        })
        .unwrap();

    let artifact_count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM agent_artifacts WHERE research_run_id = ?1 AND title = 'reports/run-card.json'",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
    assert_eq!(artifact_count, 1);
}
