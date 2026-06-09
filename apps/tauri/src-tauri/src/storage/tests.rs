use std::fs;

use rusqlite::params;
use serde_json::json;

use super::*;

#[test]
fn creates_app_data_layout_and_sqlite_schema() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    assert!(paths.run_workspaces.exists());
    assert!(paths.artifacts.exists());
    assert!(paths.backups.exists());
    let mut db = PlutusDatabase::open(&paths.database).unwrap();
    db.seed_mvp().unwrap();
    let portfolios = db.list_portfolios(MVP_PROFILE_ID).unwrap();
    assert_eq!(portfolios[0].name, "Core Portfolio");
}

#[test]
fn default_profile_bootstrap_adds_reference_data_without_demo_rows() {
    let db = PlutusDatabase::in_memory().unwrap();
    db.ensure_default_profile().unwrap();

    let account_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM accounts WHERE id = ?1",
            params![MVP_MANUAL_ACCOUNT_ID],
            |row| row.get(0),
        )
        .unwrap();
    let instrument_count: i64 = db
        .conn
        .query_row("SELECT COUNT(*) FROM instruments", [], |row| row.get(0))
        .unwrap();
    let portfolio_count: i64 = db
        .conn
        .query_row("SELECT COUNT(*) FROM portfolios", [], |row| row.get(0))
        .unwrap();
    let watchlist_count: i64 = db
        .conn
        .query_row("SELECT COUNT(*) FROM watchlists", [], |row| row.get(0))
        .unwrap();

    assert_eq!(account_count, 1);
    assert!(instrument_count >= 8);
    assert_eq!(portfolio_count, 0);
    assert_eq!(watchlist_count, 0);
}

#[test]
fn repositories_persist_portfolio_and_position_updates() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let portfolio = db
        .create_portfolio(MVP_PROFILE_ID, "Satellite", "USD")
        .unwrap();
    let position = db
        .add_position(NewPosition {
            portfolio_id: portfolio.id.clone(),
            account_id: MVP_MANUAL_ACCOUNT_ID.to_string(),
            instrument_id: MVP_NVDA_ID.to_string(),
            quantity: 1.0,
            average_cost: 100.0,
            cost_currency: "USD".to_string(),
            thesis: "Initial thesis".to_string(),
        })
        .unwrap();
    let updated = db
        .update_position_thesis(&position.id, "Updated from Mac command")
        .unwrap();
    assert_eq!(updated.thesis, "Updated from Mac command");
}

#[test]
fn persists_run_events_final_outputs_local_jobs_and_artifact_files() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut db = PlutusDatabase::open(&paths.database).unwrap();
    db.seed_mvp().unwrap();

    let run = db
        .create_research_run(NewResearchRun {
            profile_id: MVP_PROFILE_ID.to_string(),
            portfolio_id: Some(MVP_PORTFOLIO_ID.to_string()),
            user_request: "Review BTC and NVDA".to_string(),
            selected_team: "portfolio_review_committee".to_string(),
        })
        .unwrap();
    let event = db
        .append_run_event(AppendRunEvent {
            research_run_id: run.id.clone(),
            sequence: 1,
            event_type: "agent.delta".to_string(),
            payload: json!({"agent": "analyst", "text": "checking concentration"}),
        })
        .unwrap();
    let final_output = db
        .persist_final_output(PersistFinalOutput {
            research_run_id: run.id.clone(),
            summary: "Trim BTC risk and keep NVDA watch.".to_string(),
            structured_output: json!({"recommendationCategory": "rebalance"}),
        })
        .unwrap();
    let job = db
        .enqueue_local_job(EnqueueLocalJob {
            research_run_id: Some(run.id.clone()),
            job_type: "artifact.render".to_string(),
            payload: json!({"format": "json"}),
        })
        .unwrap();
    let artifact = db
        .write_artifact_file(
            &paths,
            WriteArtifactFile {
                research_run_id: run.id.clone(),
                artifact_type: "run_card".to_string(),
                title: "Run Card".to_string(),
                mime_type: "application/json".to_string(),
                metadata: json!({"source": "test"}),
                created_by_agent: "report_writer".to_string(),
                contents: br#"{"summary":"Trim BTC risk"}"#.to_vec(),
            },
        )
        .unwrap();

    assert_eq!(event.sequence, 1);
    assert_eq!(final_output.summary, "Trim BTC risk and keep NVDA watch.");
    assert_eq!(job.status, "queued");
    assert_eq!(
        fs::read(paths.root.join(&artifact.storage_key)).unwrap(),
        br#"{"summary":"Trim BTC risk"}"#,
    );
    assert_eq!(artifact.content_hash.len(), 64);
}

#[test]
fn schema_allows_local_only_memory_rows_and_wiki_links() {
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
             VALUES (?1, NULL, 'category_disabled', 'user', NULL, NULL, '{}', ?2)",
            params![new_id(), now()],
        )
        .unwrap();
    db.conn
        .execute(
            "INSERT INTO wiki_links(id, from_wiki_page_id, to_wiki_page_id, link_type, created_at)
             VALUES (?1, NULL, NULL, 'manual', ?2)",
            params![new_id(), now()],
        )
        .unwrap();

    let stored_mem0: Option<String> = db
        .conn
        .query_row(
            "SELECT mem0_id FROM memory_records WHERE id = ?1",
            [&memory_id],
            |row| row.get(0),
        )
        .unwrap();
    assert!(stored_mem0.is_none());
}
