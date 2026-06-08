use super::{
    trading::provider_config,
    trading_types::{ProviderPortfolioSyncInput, ProviderSyncedHolding},
    PlutusCommands,
};
use crate::storage::{AppDataPaths, PlutusDatabase, MVP_PROFILE_ID};

#[test]
fn sync_portfolio_from_provider_imports_configured_upbit_without_raw_secrets() {
    let temp = tempfile::tempdir().unwrap();
    let paths = AppDataPaths::create(temp.path()).unwrap();
    let db = PlutusDatabase::open(&paths.database).unwrap();
    db.ensure_default_profile().unwrap();
    let commands = PlutusCommands::new_with_paths(&db, &paths);

    let mut raw_provider = provider_config("upbit", "Upbit", "Spot crypto", "CCXT");
    raw_provider.health = "connected".to_string();
    raw_provider.credential_ref = Some("raw-upbit-secret-key".to_string());
    let scrubbed_provider = commands.save_trading_provider(raw_provider).unwrap();
    assert_eq!(scrubbed_provider.health, "not_configured");
    assert_eq!(scrubbed_provider.credential_ref, None);

    let mut provider = provider_config("upbit", "Upbit", "Spot crypto", "CCXT");
    provider.health = "connected".to_string();
    provider.credential_ref = Some("secure://plutus/providers/upbit/main".to_string());
    let saved_provider = commands.save_trading_provider(provider).unwrap();
    assert_eq!(
        saved_provider.credential_ref.as_deref(),
        Some("secure://plutus/providers/upbit/main")
    );
    let listed_provider = commands
        .list_trading_providers()
        .unwrap()
        .into_iter()
        .find(|candidate| candidate.provider_id == "upbit")
        .unwrap();
    assert_eq!(listed_provider.health, "connected");
    assert_eq!(
        listed_provider.credential_ref.as_deref(),
        Some("secure://plutus/providers/upbit/main")
    );

    let result = commands
        .sync_portfolio_from_provider(ProviderPortfolioSyncInput {
            profile_id: Some(MVP_PROFILE_ID.to_string()),
            provider_id: "upbit".to_string(),
            portfolio_id: None,
            portfolio_name: Some("Upbit Synced Holdings".to_string()),
            base_currency: Some("KRW".to_string()),
            holdings: Some(vec![
                ProviderSyncedHolding {
                    symbol: "btc-krw".to_string(),
                    name: Some("Bitcoin".to_string()),
                    quantity: 0.42,
                    average_cost: 91_000_000.0,
                    cost_currency: "KRW".to_string(),
                    thesis: Some("Imported from Upbit account balance.".to_string()),
                },
                ProviderSyncedHolding {
                    symbol: "eth-krw".to_string(),
                    name: Some("Ethereum".to_string()),
                    quantity: 2.5,
                    average_cost: 4_800_000.0,
                    cost_currency: "KRW".to_string(),
                    thesis: None,
                },
            ]),
        })
        .unwrap();

    assert_eq!(result.imported_count, 2);
    assert_eq!(result.provider_id, "upbit");
    assert_eq!(result.skipped_count, 0);
    assert_eq!(result.position_symbols, ["BTC-KRW", "ETH-KRW"]);
    let snapshot = commands
        .get_portfolio_snapshot(&result.portfolio_id)
        .unwrap();
    let snapshot_text = snapshot.to_string();
    assert!(snapshot_text.contains("BTC-KRW"));
    assert!(snapshot_text.contains("ETH-KRW"));
    assert!(!snapshot_text.contains("raw-upbit-secret-key"));
    let exported =
        std::fs::read_to_string(paths.root.join("local-tools/portfolio-state.json")).unwrap();
    assert!(!exported.contains("raw-upbit-secret-key"));
}

#[test]
fn sync_portfolio_from_provider_reuses_provider_portfolio_when_id_is_omitted() {
    let db = PlutusDatabase::in_memory().unwrap();
    db.ensure_default_profile().unwrap();
    let commands = PlutusCommands::new(&db);

    let mut provider = provider_config("upbit", "Upbit", "Spot crypto", "CCXT");
    provider.health = "connected".to_string();
    provider.credential_ref = Some("secure://plutus/providers/upbit/main".to_string());
    commands.save_trading_provider(provider).unwrap();

    let first_result = commands
        .sync_portfolio_from_provider(ProviderPortfolioSyncInput {
            profile_id: Some(MVP_PROFILE_ID.to_string()),
            provider_id: "upbit".to_string(),
            portfolio_id: None,
            portfolio_name: Some("Upbit Synced Holdings".to_string()),
            base_currency: Some("KRW".to_string()),
            holdings: Some(vec![ProviderSyncedHolding {
                symbol: "btc-krw".to_string(),
                name: Some("Bitcoin".to_string()),
                quantity: 0.42,
                average_cost: 91_000_000.0,
                cost_currency: "KRW".to_string(),
                thesis: Some("First import.".to_string()),
            }]),
        })
        .unwrap();

    let second_result = commands
        .sync_portfolio_from_provider(ProviderPortfolioSyncInput {
            profile_id: Some(MVP_PROFILE_ID.to_string()),
            provider_id: "upbit".to_string(),
            portfolio_id: None,
            portfolio_name: Some("Upbit Synced Holdings".to_string()),
            base_currency: Some("KRW".to_string()),
            holdings: Some(vec![ProviderSyncedHolding {
                symbol: "eth-krw".to_string(),
                name: Some("Ethereum".to_string()),
                quantity: 2.5,
                average_cost: 4_800_000.0,
                cost_currency: "KRW".to_string(),
                thesis: Some("Second import.".to_string()),
            }]),
        })
        .unwrap();

    assert_eq!(second_result.portfolio_id, first_result.portfolio_id);
    let portfolios = commands.list_portfolios(MVP_PROFILE_ID).unwrap();
    assert_eq!(portfolios.len(), 1);
    let snapshot = commands
        .get_portfolio_snapshot(&second_result.portfolio_id)
        .unwrap();
    let snapshot_text = snapshot.to_string();
    assert!(snapshot_text.contains("ETH-KRW"));
    assert!(!snapshot_text.contains("BTC-KRW"));
}

#[test]
fn sync_portfolio_from_provider_rejects_unconfigured_provider_without_mutating_portfolios() {
    let db = PlutusDatabase::in_memory().unwrap();
    db.ensure_default_profile().unwrap();
    let commands = PlutusCommands::new(&db);

    let err = commands
        .sync_portfolio_from_provider(ProviderPortfolioSyncInput {
            profile_id: Some(MVP_PROFILE_ID.to_string()),
            provider_id: "upbit".to_string(),
            portfolio_id: None,
            portfolio_name: Some("Upbit Synced Holdings".to_string()),
            base_currency: Some("KRW".to_string()),
            holdings: None,
        })
        .unwrap_err();

    assert_eq!(
        err.to_string(),
        "Configure provider upbit before syncing holdings."
    );
    assert!(commands.list_portfolios(MVP_PROFILE_ID).unwrap().is_empty());
}
