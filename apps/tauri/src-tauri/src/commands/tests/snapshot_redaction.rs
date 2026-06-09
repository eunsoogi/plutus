use super::*;

#[test]
fn app_snapshot_redacts_free_text_secret_fields() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    db.conn
            .execute(
                "UPDATE positions SET thesis = 'api_key sk-testvalue visible thesis' WHERE instrument_id = ?1",
                params![MVP_BTC_ID],
            )
            .unwrap();
    db.conn
            .execute(
                "INSERT INTO watchlist_items(id, watchlist_id, instrument_id, trigger_note, target_zone, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 'password=secret watch', 'broker token zone', ?4, ?4)",
                params![new_id(), MVP_WATCHLIST_ID, MVP_BTC_ID, now()],
            )
            .unwrap();
    let commands = PlutusCommands::new(&db);
    let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
    let thesis = snapshot["portfolios"][0]["positions"][0]["thesis"]
        .as_str()
        .unwrap();
    let trigger_note = snapshot["watchlists"][0]["items"][0]["triggerNote"]
        .as_str()
        .unwrap();
    let target_zone = snapshot["watchlists"][0]["items"][0]["targetZone"]
        .as_str()
        .unwrap();
    db.conn
            .execute(
                "INSERT INTO wiki_pages(id, profile_id, slug, category, title, summary, status, current_revision_id, tags, source_refs, memory_refs, freshness, confidence, created_at, updated_at)
                 VALUES (?1, ?2, 'secret-wiki', 'research', 'api_key wiki', 'broker token summary', 'active', NULL, '[]', ?3, '[]', 'fresh', 'medium', ?4, ?4)",
                params![
                    new_id(),
                    MVP_PROFILE_ID,
                    json!(["password=source"]).to_string(),
                    now()
                ],
            )
            .unwrap();
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let mut file_db = PlutusDatabase::open(&paths.database).unwrap();
    file_db.seed_mvp().unwrap();
    file_db
            .conn
            .execute(
                "UPDATE positions SET thesis = 'api_key sk-testvalue visible thesis' WHERE instrument_id = ?1",
                params![MVP_BTC_ID],
            )
            .unwrap();
    file_db
            .conn
            .execute(
                "INSERT INTO watchlist_items(id, watchlist_id, instrument_id, trigger_note, target_zone, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 'password=secret watch', 'broker token zone', ?4, ?4)",
                params![new_id(), MVP_WATCHLIST_ID, MVP_BTC_ID, now()],
            )
            .unwrap();
    let file_commands = PlutusCommands::new_with_paths(&file_db, &paths);
    file_commands
        .export_local_tool_portfolio_state(MVP_PROFILE_ID)
        .unwrap();
    let exported = fs::read_to_string(paths.root.join("local-tools/portfolio-state.json")).unwrap();
    assert!(thesis.contains("[REDACTED]"));
    assert!(trigger_note.contains("[REDACTED]"));
    assert!(target_zone.contains("[REDACTED]"));
    let snapshot = commands.get_app_snapshot(MVP_PROFILE_ID).unwrap();
    let wiki_pages = snapshot["wikiPages"].as_array().unwrap();
    let secret_wiki = wiki_pages
        .iter()
        .find(|page| page["slug"].as_str() == Some("secret-wiki"))
        .unwrap();
    let secret_wiki_text = secret_wiki.to_string();
    assert!(secret_wiki_text.contains("[REDACTED]"));
    assert!(!secret_wiki_text.contains("api_key"));
    assert!(!secret_wiki_text.contains("broker token"));
    assert!(!secret_wiki_text.contains("password=source"));
    assert!(exported.contains("[REDACTED]"));
    assert!(!exported.contains("sk-testvalue"));
    assert!(!exported.contains("password=secret"));
}
