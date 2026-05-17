use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

const MIGRATION_001: &str = include_str!("migrations/001_init.sql");

pub const MVP_PROFILE_ID: &str = "018f3f5d-0000-7000-8000-000000000001";
pub const MVP_PORTFOLIO_ID: &str = "018f3f5d-0000-7000-8000-000000000002";
pub const MVP_MANUAL_ACCOUNT_ID: &str = "018f3f5d-0000-7000-8000-000000000003";
pub const MVP_WATCHLIST_ID: &str = "018f3f5d-0000-7000-8000-000000000004";
pub const MVP_NVDA_ID: &str = "018f3f5d-0000-7000-8000-000000000102";
pub const MVP_BTC_ID: &str = "018f3f5d-0000-7000-8000-000000000103";

#[derive(Debug, Clone)]
pub struct AppDataPaths {
    pub root: PathBuf,
    pub database: PathBuf,
    pub run_workspaces: PathBuf,
    pub artifacts: PathBuf,
    pub backups: PathBuf,
    pub wiki: PathBuf,
    pub secure_storage: PathBuf,
}

impl AppDataPaths {
    pub fn create(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref().to_path_buf();
        let paths = Self {
            database: root.join("plutus.sqlite3"),
            run_workspaces: root.join("runs"),
            artifacts: root.join("artifacts"),
            backups: root.join("backups"),
            wiki: root.join("wiki"),
            secure_storage: root.join("secure"),
            root,
        };
        for path in [
            &paths.root,
            &paths.run_workspaces,
            &paths.artifacts,
            &paths.backups,
            &paths.wiki,
            &paths.secure_storage,
        ] {
            fs::create_dir_all(path)
                .with_context(|| format!("failed to create {}", path.display()))?;
        }
        Ok(paths)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Portfolio {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub base_currency: String,
    pub benchmark_id: Option<String>,
    pub risk_profile: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Position {
    pub id: String,
    pub portfolio_id: String,
    pub account_id: String,
    pub instrument_id: String,
    pub quantity: f64,
    pub average_cost: f64,
    pub cost_currency: String,
    pub thesis: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Watchlist {
    pub id: String,
    pub profile_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResearchRun {
    pub id: String,
    pub profile_id: String,
    pub portfolio_id: Option<String>,
    pub status: String,
    pub user_request: String,
    pub selected_team: String,
    pub codex_thread_id: Option<String>,
    pub workspace_path: String,
    pub recommendation_category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Artifact {
    pub id: String,
    pub research_run_id: String,
    pub artifact_type: String,
    pub title: String,
    pub storage_key: String,
    pub content_hash: String,
    pub mime_type: String,
}

pub struct PlutusDatabase {
    pub conn: Connection,
}

impl PlutusDatabase {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(MIGRATION_001)?;
        Ok(())
    }

    pub fn seed_mvp(&mut self) -> Result<()> {
        let tx = self.conn.transaction()?;
        let now = now();
        tx.execute(
            "INSERT OR IGNORE INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            params![MVP_PROFILE_ID, "MVP Profile", now],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO accounts(id, profile_id, name, account_type, base_currency, created_at, updated_at) VALUES (?1, ?2, 'Manual Brokerage', 'manual', 'USD', ?3, ?3)",
            params![MVP_MANUAL_ACCOUNT_ID, MVP_PROFILE_ID, now],
        )?;
        let instruments = [
            (MVP_NVDA_ID, "stock", "NVDA", "NVIDIA Corporation", "USD", "NASDAQ"),
            (MVP_BTC_ID, "crypto", "BTC-USD", "Bitcoin", "USD", "CRYPTO"),
            ("018f3f5d-0000-7000-8000-000000000101", "stock", "AAPL", "Apple Inc.", "USD", "NASDAQ"),
            ("018f3f5d-0000-7000-8000-000000000104", "crypto", "ETH-USD", "Ethereum", "USD", "CRYPTO"),
            ("018f3f5d-0000-7000-8000-000000000105", "stablecoin", "USDC-USD", "USD Coin", "USD", "CRYPTO"),
            ("018f3f5d-0000-7000-8000-000000000106", "cash", "USD", "US Dollar Cash", "USD", "CASH"),
            ("018f3f5d-0000-7000-8000-000000000107", "etf", "SPY", "SPDR S&P 500 ETF", "USD", "NYSEARCA"),
            ("018f3f5d-0000-7000-8000-000000000108", "etf", "QQQ", "Invesco QQQ Trust", "USD", "NASDAQ"),
        ];
        for (id, asset_type, symbol, name, currency, exchange) in instruments {
            tx.execute(
                "INSERT OR IGNORE INTO instruments(id, asset_type, canonical_symbol, display_symbol, name, currency, exchange, provider_refs, status, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, 'active', ?8, ?8)",
                params![id, asset_type, symbol, name, currency, exchange, json!({"fixture": symbol}).to_string(), now],
            )?;
        }
        tx.execute(
            "INSERT OR IGNORE INTO portfolios(id, profile_id, name, base_currency, benchmark_id, risk_profile, created_at, updated_at) VALUES (?1, ?2, 'Core Portfolio', 'USD', ?3, ?4, ?5, ?5)",
            params![MVP_PORTFOLIO_ID, MVP_PROFILE_ID, "018f3f5d-0000-7000-8000-000000000107", json!({"maxSingleAssetPct": 35}).to_string(), now],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO positions(id, portfolio_id, account_id, instrument_id, quantity, average_cost, cost_currency, fees_total, acquired_at, risk_bucket, tags, thesis, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 12, 180.0, 'USD', 0, NULL, 'growth', ?5, 'AI infrastructure exposure requires valuation discipline.', ?6, ?6)",
            params![Uuid::now_v7().to_string(), MVP_PORTFOLIO_ID, MVP_MANUAL_ACCOUNT_ID, MVP_NVDA_ID, json!(["semiconductor"]).to_string(), now],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO positions(id, portfolio_id, account_id, instrument_id, quantity, average_cost, cost_currency, fees_total, acquired_at, risk_bucket, tags, thesis, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 0.35, 52000.0, 'USD', 0, NULL, 'speculative', ?5, 'BTC diversifies but increases volatility.', ?6, ?6)",
            params![Uuid::now_v7().to_string(), MVP_PORTFOLIO_ID, MVP_MANUAL_ACCOUNT_ID, MVP_BTC_ID, json!(["crypto"]).to_string(), now],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO watchlists(id, profile_id, name, created_at, updated_at) VALUES (?1, ?2, 'Default Watchlist', ?3, ?3)",
            params![MVP_WATCHLIST_ID, MVP_PROFILE_ID, now],
        )?;
        tx.commit()?;
        Ok(())
    }
}

pub fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn new_id() -> String {
    Uuid::now_v7().to_string()
}

pub fn json_text(value: serde_json::Value) -> String {
    value.to_string()
}

pub trait PortfolioRepository {
    fn list_portfolios(&self, profile_id: &str) -> Result<Vec<Portfolio>>;
    fn create_portfolio(&self, profile_id: &str, name: &str, base_currency: &str) -> Result<Portfolio>;
    fn add_position(&self, input: NewPosition) -> Result<Position>;
    fn update_position_thesis(&self, position_id: &str, thesis: &str) -> Result<Position>;
}

#[derive(Debug, Clone)]
pub struct NewPosition {
    pub portfolio_id: String,
    pub account_id: String,
    pub instrument_id: String,
    pub quantity: f64,
    pub average_cost: f64,
    pub cost_currency: String,
    pub thesis: String,
}

impl PortfolioRepository for PlutusDatabase {
    fn list_portfolios(&self, profile_id: &str) -> Result<Vec<Portfolio>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, name, base_currency, benchmark_id, risk_profile, created_at, updated_at FROM portfolios WHERE profile_id = ?1 ORDER BY name",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let risk_profile: String = row.get(5)?;
            Ok(Portfolio {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                base_currency: row.get(3)?,
                benchmark_id: row.get(4)?,
                risk_profile: serde_json::from_str(&risk_profile).unwrap_or_else(|_| json!({})),
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
    }

    fn create_portfolio(&self, profile_id: &str, name: &str, base_currency: &str) -> Result<Portfolio> {
        let portfolio = Portfolio {
            id: new_id(),
            profile_id: profile_id.to_string(),
            name: name.to_string(),
            base_currency: base_currency.to_string(),
            benchmark_id: None,
            risk_profile: json!({}),
            created_at: now(),
            updated_at: now(),
        };
        self.conn.execute(
            "INSERT INTO portfolios(id, profile_id, name, base_currency, benchmark_id, risk_profile, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![portfolio.id, portfolio.profile_id, portfolio.name, portfolio.base_currency, portfolio.benchmark_id, portfolio.risk_profile.to_string(), portfolio.created_at, portfolio.updated_at],
        )?;
        Ok(portfolio)
    }

    fn add_position(&self, input: NewPosition) -> Result<Position> {
        let position = Position {
            id: new_id(),
            portfolio_id: input.portfolio_id,
            account_id: input.account_id,
            instrument_id: input.instrument_id,
            quantity: input.quantity,
            average_cost: input.average_cost,
            cost_currency: input.cost_currency,
            thesis: input.thesis,
        };
        let timestamp = now();
        self.conn.execute(
            "INSERT INTO positions(id, portfolio_id, account_id, instrument_id, quantity, average_cost, cost_currency, fees_total, acquired_at, risk_bucket, tags, thesis, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, NULL, NULL, '[]', ?8, ?9, ?9)",
            params![position.id, position.portfolio_id, position.account_id, position.instrument_id, position.quantity, position.average_cost, position.cost_currency, position.thesis, timestamp],
        )?;
        Ok(position)
    }

    fn update_position_thesis(&self, position_id: &str, thesis: &str) -> Result<Position> {
        self.conn.execute(
            "UPDATE positions SET thesis = ?1, updated_at = ?2 WHERE id = ?3",
            params![thesis, now(), position_id],
        )?;
        self.conn
            .query_row(
                "SELECT id, portfolio_id, account_id, instrument_id, quantity, average_cost, cost_currency, thesis FROM positions WHERE id = ?1",
                params![position_id],
                |row| {
                    Ok(Position {
                        id: row.get(0)?,
                        portfolio_id: row.get(1)?,
                        account_id: row.get(2)?,
                        instrument_id: row.get(3)?,
                        quantity: row.get(4)?,
                        average_cost: row.get(5)?,
                        cost_currency: row.get(6)?,
                        thesis: row.get(7)?,
                    })
                },
            )
            .optional()?
            .context("position not found")
    }
}

#[cfg(test)]
mod tests {
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
}
