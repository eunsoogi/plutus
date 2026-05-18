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
pub struct RunEvent {
    pub id: String,
    pub research_run_id: String,
    pub sequence: i64,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FinalOutput {
    pub id: String,
    pub research_run_id: String,
    pub summary: String,
    pub structured_output: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LocalJob {
    pub id: String,
    pub research_run_id: Option<String>,
    pub job_type: String,
    pub status: String,
    pub payload: serde_json::Value,
    pub attempts: i64,
    pub created_at: String,
    pub updated_at: String,
    pub available_at: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewResearchRun {
    pub profile_id: String,
    pub portfolio_id: Option<String>,
    pub user_request: String,
    pub selected_team: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppendRunEvent {
    pub research_run_id: String,
    pub sequence: i64,
    pub event_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistFinalOutput {
    pub research_run_id: String,
    pub summary: String,
    pub structured_output: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnqueueLocalJob {
    pub research_run_id: Option<String>,
    pub job_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteArtifactFile {
    pub research_run_id: String,
    pub artifact_type: String,
    pub title: String,
    pub mime_type: String,
    pub metadata: serde_json::Value,
    pub created_by_agent: String,
    pub contents: Vec<u8>,
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

    pub fn create_research_run(&self, input: NewResearchRun) -> Result<ResearchRun> {
        let run = ResearchRun {
            id: new_id(),
            profile_id: input.profile_id,
            portfolio_id: input.portfolio_id,
            status: "queued".to_string(),
            user_request: input.user_request,
            selected_team: input.selected_team,
            codex_thread_id: None,
            workspace_path: format!("runs/{}", new_id()),
            recommendation_category: None,
        };
        self.conn.execute(
            "INSERT INTO research_runs(id, profile_id, portfolio_id, status, user_request, selected_team, codex_thread_id, workspace_path, custom_agent_versions, local_tool_config_hash, model_config, started_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, '{}', 'local-tools-v1', '{}', ?8)",
            params![run.id, run.profile_id, run.portfolio_id, run.status, run.user_request, run.selected_team, run.workspace_path, now()],
        )?;
        Ok(run)
    }

    pub fn append_run_event(&self, input: AppendRunEvent) -> Result<RunEvent> {
        let event = RunEvent {
            id: new_id(),
            research_run_id: input.research_run_id,
            sequence: input.sequence,
            event_type: input.event_type,
            payload: input.payload,
            created_at: now(),
        };
        self.conn.execute(
            "INSERT INTO research_run_events(id, research_run_id, sequence, event_type, payload, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![event.id, event.research_run_id, event.sequence, event.event_type, event.payload.to_string(), event.created_at],
        )?;
        Ok(event)
    }

    pub fn persist_final_output(&self, input: PersistFinalOutput) -> Result<FinalOutput> {
        let output = FinalOutput {
            id: new_id(),
            research_run_id: input.research_run_id,
            summary: input.summary,
            structured_output: input.structured_output,
            created_at: now(),
        };
        self.conn.execute(
            "INSERT INTO research_run_final_outputs(id, research_run_id, summary, structured_output, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![output.id, output.research_run_id, output.summary, output.structured_output.to_string(), output.created_at],
        )?;
        self.conn.execute(
            "UPDATE research_runs SET status = 'completed', completed_at = ?1, recommendation_category = ?2 WHERE id = ?3",
            params![
                output.created_at,
                output
                    .structured_output
                    .get("recommendationCategory")
                    .and_then(|value| value.as_str()),
                output.research_run_id
            ],
        )?;
        Ok(output)
    }

    pub fn enqueue_local_job(&self, input: EnqueueLocalJob) -> Result<LocalJob> {
        let timestamp = now();
        let job = LocalJob {
            id: new_id(),
            research_run_id: input.research_run_id,
            job_type: input.job_type,
            status: "queued".to_string(),
            payload: input.payload,
            attempts: 0,
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
            available_at: timestamp,
        };
        self.conn.execute(
            "INSERT INTO local_job_queue(id, research_run_id, job_type, status, payload, attempts, created_at, updated_at, available_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![job.id, job.research_run_id, job.job_type, job.status, job.payload.to_string(), job.attempts, job.created_at, job.updated_at, job.available_at],
        )?;
        Ok(job)
    }

    pub fn write_artifact_file(
        &self,
        paths: &AppDataPaths,
        input: WriteArtifactFile,
    ) -> Result<Artifact> {
        let artifact_id = new_id();
        let storage_key = format!("runs/{}/artifacts/{artifact_id}", input.research_run_id);
        let target = paths.root.join(&storage_key);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&target, &input.contents)
            .with_context(|| format!("failed to write artifact {}", target.display()))?;

        let artifact = Artifact {
            id: artifact_id,
            research_run_id: input.research_run_id,
            artifact_type: input.artifact_type,
            title: input.title,
            storage_key,
            content_hash: sha256_hex(&input.contents),
            mime_type: input.mime_type,
        };
        self.conn.execute(
            "INSERT INTO agent_artifacts(id, research_run_id, artifact_type, title, storage_key, content_hash, mime_type, metadata, created_by_agent, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![artifact.id, artifact.research_run_id, artifact.artifact_type, artifact.title, artifact.storage_key, artifact.content_hash, artifact.mime_type, input.metadata.to_string(), input.created_by_agent, now()],
        )?;
        Ok(artifact)
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

pub fn sha256_hex(contents: &[u8]) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(contents);
    hex::encode(hasher.finalize())
}

pub trait PortfolioRepository {
    fn list_portfolios(&self, profile_id: &str) -> Result<Vec<Portfolio>>;
    fn create_portfolio(
        &self,
        profile_id: &str,
        name: &str,
        base_currency: &str,
    ) -> Result<Portfolio>;
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
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn create_portfolio(
        &self,
        profile_id: &str,
        name: &str,
        base_currency: &str,
    ) -> Result<Portfolio> {
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
}
