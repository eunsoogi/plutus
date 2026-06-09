use super::*;

#[test]
fn artifact_access_rejects_wrong_run_scope() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let run_a = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Review A".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    let run_b = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Review B".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    let artifact_id = seed_run_artifact(&db, &run_b.id).unwrap();
    let commands = PlutusCommands::new(&db);

    let rejected =
        commands.get_artifact_for_profile_and_run(&artifact_id, MVP_PROFILE_ID, Some(&run_a.id));
    assert!(rejected
        .unwrap_err()
        .to_string()
        .contains("artifact outside requested run"));
}

#[test]
fn final_output_rejects_escaping_artifact_paths_before_completion() {
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
    fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
    let commands = PlutusCommands::new_with_paths(&db, &paths);
    let outside = temp.path().join("outside-secret.txt");
    fs::write(&outside, "secret").unwrap();

    let rejected = commands.persist_validated_final_output(PersistFinalOutput {
        research_run_id: run.id.clone(),
        summary: "Escaping artifact".to_string(),
        structured_output: {
            let mut card = valid_final_card("Escaping artifact", "risk_warning");
            card["artifactPaths"] = json!([outside.display().to_string()]);
            card
        },
    });

    assert!(rejected
        .unwrap_err()
        .to_string()
        .contains("must be relative to run workspace"));
    assert_ne!(
        commands.get_research_run(&run.id).unwrap().status,
        "completed"
    );
}

#[test]
fn final_output_rejects_non_string_artifact_refs_and_paths() {
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
    fs::create_dir_all(paths.run_workspaces.join(&run.id)).unwrap();
    let commands = PlutusCommands::new_with_paths(&db, &paths);

    let bad_ref = commands.persist_validated_final_output(PersistFinalOutput {
        research_run_id: run.id.clone(),
        summary: "Bad ref".to_string(),
        structured_output: {
            let mut card = valid_final_card("Bad ref", "risk_warning");
            card["artifactRefs"] = json!([123]);
            card
        },
    });
    assert!(bad_ref
        .unwrap_err()
        .to_string()
        .contains("artifactRefs must contain string values"));

    let bad_path = commands.persist_validated_final_output(PersistFinalOutput {
        research_run_id: run.id.clone(),
        summary: "Bad path".to_string(),
        structured_output: {
            let mut card = valid_final_card("Bad path", "risk_warning");
            card["artifactPaths"] = json!([{}]);
            card
        },
    });
    assert!(bad_path
        .unwrap_err()
        .to_string()
        .contains("artifactPaths must contain string values"));
    assert_ne!(
        commands.get_research_run(&run.id).unwrap().status,
        "completed"
    );
}

#[test]
fn final_output_accepts_runtime_run_card_shape_and_projects_refs_to_snapshot() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut db = PlutusDatabase::in_memory().unwrap();
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
    db.write_artifact_file(
        &paths,
        WriteArtifactFile {
            research_run_id: run.id.clone(),
            artifact_type: "run_card".to_string(),
            title: "runtime-run-card".to_string(),
            mime_type: "application/json".to_string(),
            metadata: json!({"source": "test"}),
            created_by_agent: "report_writer".to_string(),
            contents: br#"{"title":"Runtime run card"}"#.to_vec(),
        },
    )
    .unwrap();

    commands
        .persist_validated_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Runtime run card".to_string(),
            structured_output: {
                let mut card = valid_final_card("Runtime run card", "risk_warning");
                card["category"] = json!("risk_warning");
                card["riskValidation"] = json!("vetoed");
                card["warnings"] = json!(["Concentration remains elevated"]);
                card["artifactRefs"] = json!(["runtime-run-card"]);
                card
            },
        })
        .unwrap();
    assert_eq!(
        commands
            .get_research_run(&run.id)
            .unwrap()
            .recommendation_category,
        Some("no_action".to_string())
    );

    let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
    let artifacts = snapshot["artifacts"].as_array().unwrap();
    assert!(artifacts.iter().any(|artifact| {
        artifact["researchRunId"].as_str() == Some(run.id.as_str())
            && artifact["title"].as_str() == Some("runtime-run-card")
    }));
    let artifact_path: String = db
            .conn
            .query_row(
                "SELECT storage_key FROM agent_artifacts WHERE research_run_id = ?1 AND title = 'runtime-run-card'",
                [&run.id],
                |row| row.get(0),
            )
            .unwrap();
    assert!(paths.root.join(artifact_path).is_file());
    assert_eq!(
        snapshot["memoryActivity"][0]["researchRunId"].as_str(),
        Some(run.id.as_str())
    );
    assert!(snapshot["memoryActivity"]
        .as_array()
        .unwrap()
        .iter()
        .any(|activity| activity["payload"]["summary"] == "Runtime run card"));
    assert!(snapshot["wikiPages"]
        .as_array()
        .unwrap()
        .iter()
        .any(|page| {
            page["title"] == "Runtime run card" && page["sourceRefs"][0] == "portfolio:core"
        }));
}
