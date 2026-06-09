use std::path::Path;

use anyhow::Result;
use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

use super::util::now;

const MIGRATION_001: &str = include_str!("migrations/001_init.sql");

pub const MVP_PROFILE_ID: &str = "018f3f5d-0000-7000-8000-000000000001";
pub const MVP_PORTFOLIO_ID: &str = "018f3f5d-0000-7000-8000-000000000002";
pub const MVP_MANUAL_ACCOUNT_ID: &str = "018f3f5d-0000-7000-8000-000000000003";
pub const MVP_WATCHLIST_ID: &str = "018f3f5d-0000-7000-8000-000000000004";
pub const MVP_NVDA_ID: &str = "018f3f5d-0000-7000-8000-000000000102";
pub const MVP_BTC_ID: &str = "018f3f5d-0000-7000-8000-000000000103";

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

    pub fn ensure_default_profile(&self) -> Result<()> {
        let timestamp = now();
        self.conn.execute(
            "INSERT OR IGNORE INTO local_profiles(id, display_name, created_at, updated_at) VALUES (?1, 'Default Profile', ?2, ?2)",
            params![MVP_PROFILE_ID, timestamp],
        )?;
        self.conn.execute(
            "INSERT OR IGNORE INTO accounts(id, profile_id, name, account_type, base_currency, created_at, updated_at) VALUES (?1, ?2, 'Manual Brokerage', 'manual', 'USD', ?3, ?3)",
            params![MVP_MANUAL_ACCOUNT_ID, MVP_PROFILE_ID, timestamp],
        )?;
        self.ensure_instrument_catalog(&timestamp)?;
        Ok(())
    }

    fn ensure_instrument_catalog(&self, timestamp: &str) -> Result<()> {
        let instruments = [
            (
                MVP_NVDA_ID,
                "stock",
                "NVDA",
                "NVIDIA Corporation",
                "USD",
                "NASDAQ",
                json!({"yahoo-compatible": "NVDA"}),
            ),
            (
                MVP_BTC_ID,
                "crypto",
                "BTC-USD",
                "Bitcoin",
                "USD",
                "CRYPTO",
                json!({"coingecko": "bitcoin"}),
            ),
            (
                "018f3f5d-0000-7000-8000-000000000101",
                "stock",
                "AAPL",
                "Apple Inc.",
                "USD",
                "NASDAQ",
                json!({"yahoo-compatible": "AAPL"}),
            ),
            (
                "018f3f5d-0000-7000-8000-000000000104",
                "crypto",
                "ETH-USD",
                "Ethereum",
                "USD",
                "CRYPTO",
                json!({"coingecko": "ethereum"}),
            ),
            (
                "018f3f5d-0000-7000-8000-000000000105",
                "stablecoin",
                "USDC-USD",
                "USD Coin",
                "USD",
                "CRYPTO",
                json!({"coingecko": "usd-coin"}),
            ),
            (
                "018f3f5d-0000-7000-8000-000000000106",
                "cash",
                "USD",
                "US Dollar Cash",
                "USD",
                "CASH",
                json!({"local_catalog": "USD"}),
            ),
            (
                "018f3f5d-0000-7000-8000-000000000107",
                "etf",
                "SPY",
                "SPDR S&P 500 ETF",
                "USD",
                "NYSEARCA",
                json!({"yahoo-compatible": "SPY"}),
            ),
            (
                "018f3f5d-0000-7000-8000-000000000108",
                "etf",
                "QQQ",
                "Invesco QQQ Trust",
                "USD",
                "NASDAQ",
                json!({"yahoo-compatible": "QQQ"}),
            ),
        ];
        for (id, asset_type, symbol, name, currency, exchange, provider_refs) in instruments {
            self.conn.execute(
                "INSERT OR IGNORE INTO instruments(id, asset_type, canonical_symbol, display_symbol, name, currency, exchange, provider_refs, status, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, 'active', ?8, ?8)",
                params![id, asset_type, symbol, name, currency, exchange, provider_refs.to_string(), timestamp],
            )?;
        }
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
            (
                MVP_NVDA_ID,
                "stock",
                "NVDA",
                "NVIDIA Corporation",
                "USD",
                "NASDAQ",
            ),
            (MVP_BTC_ID, "crypto", "BTC-USD", "Bitcoin", "USD", "CRYPTO"),
            (
                "018f3f5d-0000-7000-8000-000000000101",
                "stock",
                "AAPL",
                "Apple Inc.",
                "USD",
                "NASDAQ",
            ),
            (
                "018f3f5d-0000-7000-8000-000000000104",
                "crypto",
                "ETH-USD",
                "Ethereum",
                "USD",
                "CRYPTO",
            ),
            (
                "018f3f5d-0000-7000-8000-000000000105",
                "stablecoin",
                "USDC-USD",
                "USD Coin",
                "USD",
                "CRYPTO",
            ),
            (
                "018f3f5d-0000-7000-8000-000000000106",
                "cash",
                "USD",
                "US Dollar Cash",
                "USD",
                "CASH",
            ),
            (
                "018f3f5d-0000-7000-8000-000000000107",
                "etf",
                "SPY",
                "SPDR S&P 500 ETF",
                "USD",
                "NYSEARCA",
            ),
            (
                "018f3f5d-0000-7000-8000-000000000108",
                "etf",
                "QQQ",
                "Invesco QQQ Trust",
                "USD",
                "NASDAQ",
            ),
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
