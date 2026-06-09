use super::*;

#[test]
fn watchlist_mutations_are_scoped_to_active_profile() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let commands = PlutusCommands::new(&db);
    let timestamp = now();
    let other_profile_id = "018f3f5d-0000-7000-8000-222222222222";
    db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile_id, timestamp],
            )
            .unwrap();
    let other_watchlist = commands
        .create_watchlist(CreateWatchlistInput {
            profile_id: other_profile_id.to_string(),
            name: "Other Watchlist".to_string(),
        })
        .unwrap();

    let denied_add = commands.add_watchlist_item(WatchlistItemInput {
        profile_id: MVP_PROFILE_ID.to_string(),
        watchlist_id: other_watchlist.id.clone(),
        symbol: "BTC-USD".to_string(),
        trigger_note: None,
        target_zone: None,
    });
    assert!(denied_add
        .unwrap_err()
        .to_string()
        .contains("watchlist outside active profile"));

    let other_item = commands
        .add_watchlist_item(WatchlistItemInput {
            profile_id: other_profile_id.to_string(),
            watchlist_id: other_watchlist.id,
            symbol: "BTC-USD".to_string(),
            trigger_note: None,
            target_zone: None,
        })
        .unwrap();
    let denied_update = commands.update_watchlist_item(UpdateWatchlistItemInput {
        profile_id: MVP_PROFILE_ID.to_string(),
        item_id: other_item["id"].as_str().unwrap().to_string(),
        trigger_note: Some("cross-profile edit".to_string()),
        target_zone: None,
    });
    assert!(denied_update
        .unwrap_err()
        .to_string()
        .contains("watchlist item outside active profile"));
}

#[test]
fn portfolio_mutations_and_runs_are_scoped_to_active_profile() {
    let mut db = PlutusDatabase::in_memory().unwrap();
    db.seed_mvp().unwrap();
    let commands = PlutusCommands::new(&db);
    let timestamp = now();
    let other_profile_id = "018f3f5d-0000-7000-8000-333333333333";
    db.conn
            .execute(
                "INSERT INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Other', ?2, ?2)",
                params![other_profile_id, timestamp],
            )
            .unwrap();
    let other_portfolio = commands
        .create_portfolio(CreatePortfolioInput {
            profile_id: other_profile_id.to_string(),
            name: "Other Portfolio".to_string(),
            base_currency: "USD".to_string(),
        })
        .unwrap();

    let denied_run = commands.start_research_run(StartResearchRunInput {
        profile_id: MVP_PROFILE_ID.to_string(),
        portfolio_id: Some(other_portfolio.id.clone()),
        user_request: "Review other portfolio".to_string(),
        selected_team: None,
    });
    assert!(denied_run
        .unwrap_err()
        .to_string()
        .contains("portfolio outside active profile"));

    let denied_add = commands.add_portfolio_position(PositionInput {
        profile_id: MVP_PROFILE_ID.to_string(),
        portfolio_id: other_portfolio.id.clone(),
        account_id: None,
        symbol: "BTC-USD".to_string(),
        quantity: 1.0,
        average_cost: 1.0,
        cost_currency: None,
        thesis: None,
    });
    assert!(denied_add
        .unwrap_err()
        .to_string()
        .contains("portfolio outside active profile"));

    let position_id: String = db
        .conn
        .query_row(
            "SELECT id FROM positions WHERE portfolio_id = ?1 LIMIT 1",
            [MVP_PORTFOLIO_ID],
            |row| row.get(0),
        )
        .unwrap();
    let denied_update = commands.update_portfolio_position(UpdatePositionInput {
        profile_id: other_profile_id.to_string(),
        position_id,
        quantity: Some(2.0),
        thesis: None,
    });
    assert!(denied_update
        .unwrap_err()
        .to_string()
        .contains("position outside active profile"));
}
