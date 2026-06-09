use anyhow::{Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::json;

use super::database::PlutusDatabase;
use super::models::{Portfolio, Position};
use super::util::{new_id, now};

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
