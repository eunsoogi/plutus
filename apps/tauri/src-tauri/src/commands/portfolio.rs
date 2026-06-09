use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

use crate::audit::record_audit_event;
use crate::storage::{
    new_id, now, NewPosition, Portfolio, PortfolioRepository, Position, Watchlist,
    MVP_MANUAL_ACCOUNT_ID,
};

use super::inputs::{
    CreatePortfolioInput, CreateWatchlistInput, PositionInput, UpdatePositionInput,
    UpdateWatchlistItemInput, WatchlistItemInput,
};
use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub fn list_portfolios(&self, profile_id: &str) -> Result<Vec<Portfolio>> {
        self.db.list_portfolios(profile_id)
    }

    pub fn create_portfolio(&self, input: CreatePortfolioInput) -> Result<Portfolio> {
        let portfolio =
            self.db
                .create_portfolio(&input.profile_id, &input.name, &input.base_currency)?;
        self.export_local_tool_portfolio_state(&input.profile_id)?;
        record_audit_event(
            self.db,
            Some(&input.profile_id),
            None,
            "user",
            "portfolio.create",
            &portfolio.id,
            &json!({"name": portfolio.name}),
        )?;
        Ok(portfolio)
    }

    pub fn list_watchlists(&self, profile_id: &str) -> Result<Vec<Watchlist>> {
        let mut stmt = self
            .db
            .conn
            .prepare("SELECT id, profile_id, name FROM watchlists WHERE profile_id = ?1")?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(Watchlist {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn get_portfolio_snapshot(&self, portfolio_id: &str) -> Result<Value> {
        let portfolio = self.db.conn.query_row(
            "SELECT id, profile_id, name, base_currency, benchmark_id, risk_profile, created_at, updated_at FROM portfolios WHERE id = ?1",
            params![portfolio_id],
            |row| {
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
            },
        ).optional()?.context("portfolio not found")?;
        let mut stmt = self.db.conn.prepare(
            "SELECT p.id, i.display_symbol, p.quantity, p.average_cost, p.cost_currency, p.thesis
             FROM positions p JOIN instruments i ON i.id = p.instrument_id
             WHERE p.portfolio_id = ?1 ORDER BY i.display_symbol",
        )?;
        let positions = stmt
            .query_map(params![portfolio_id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "symbol": row.get::<_, String>(1)?,
                    "quantity": row.get::<_, f64>(2)?,
                    "averageCost": row.get::<_, f64>(3)?,
                    "costCurrency": row.get::<_, String>(4)?,
                    "thesis": row.get::<_, String>(5)?,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(json!({"portfolio": portfolio, "positions": positions, "hostTimestamp": now()}))
    }

    pub fn get_portfolio_snapshot_for_profile(
        &self,
        portfolio_id: &str,
        profile_id: &str,
    ) -> Result<Value> {
        let owner_profile_id = self
            .profile_id_for_portfolio(portfolio_id)?
            .context("portfolio not found")?;
        if owner_profile_id != profile_id {
            bail!("portfolio outside active profile");
        }
        self.get_portfolio_snapshot(portfolio_id)
    }

    pub fn add_portfolio_position(&self, input: PositionInput) -> Result<Position> {
        let portfolio_id = input.portfolio_id.clone();
        let owner_profile_id = self
            .profile_id_for_portfolio(&portfolio_id)?
            .context("portfolio not found")?;
        if owner_profile_id != input.profile_id {
            bail!("portfolio outside active profile");
        }
        let instrument_id = self.resolve_instrument_id(&input.symbol)?;
        let position = self.db.add_position(NewPosition {
            portfolio_id: input.portfolio_id,
            account_id: input
                .account_id
                .unwrap_or_else(|| MVP_MANUAL_ACCOUNT_ID.to_string()),
            instrument_id,
            quantity: input.quantity,
            average_cost: input.average_cost,
            cost_currency: input.cost_currency.unwrap_or_else(|| "USD".to_string()),
            thesis: input.thesis.unwrap_or_default(),
        })?;
        self.export_local_tool_portfolio_state(&owner_profile_id)?;
        Ok(position)
    }

    pub fn update_portfolio_position(&self, input: UpdatePositionInput) -> Result<Position> {
        let existing_position = self.load_position(&input.position_id)?;
        let owner_profile_id = self
            .profile_id_for_portfolio(&existing_position.portfolio_id)?
            .context("portfolio not found")?;
        if owner_profile_id != input.profile_id {
            bail!("position outside active profile");
        }
        if let Some(quantity) = input.quantity {
            self.db.conn.execute(
                "UPDATE positions SET quantity = ?1, updated_at = ?2 WHERE id = ?3",
                params![quantity, now(), input.position_id],
            )?;
        }
        if let Some(thesis) = input.thesis.as_deref() {
            self.db.update_position_thesis(&input.position_id, thesis)?;
        }
        let position = self.load_position(&input.position_id)?;
        self.export_local_tool_portfolio_state(&owner_profile_id)?;
        Ok(position)
    }

    pub fn create_watchlist(&self, input: CreateWatchlistInput) -> Result<Watchlist> {
        let watchlist = Watchlist {
            id: new_id(),
            profile_id: input.profile_id,
            name: input.name,
        };
        self.db.conn.execute(
            "INSERT INTO watchlists(id, profile_id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![watchlist.id, watchlist.profile_id, watchlist.name, now()],
        )?;
        self.export_local_tool_portfolio_state(&watchlist.profile_id)?;
        Ok(watchlist)
    }

    pub fn add_watchlist_item(&self, input: WatchlistItemInput) -> Result<Value> {
        let watchlist_id = input.watchlist_id.clone();
        let owner_profile_id = self
            .profile_id_for_watchlist(&watchlist_id)?
            .context("watchlist not found")?;
        if owner_profile_id != input.profile_id {
            bail!("watchlist outside active profile");
        }
        let instrument_id = self.resolve_instrument_id(&input.symbol)?;
        let id = new_id();
        let timestamp = now();
        self.db.conn.execute(
            "INSERT INTO watchlist_items(id, watchlist_id, instrument_id, trigger_note, target_zone, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![
                id,
                input.watchlist_id,
                instrument_id,
                input.trigger_note.unwrap_or_default(),
                input.target_zone.unwrap_or_else(|| "watch".to_string()),
                timestamp
            ],
        )?;
        let item = self.load_watchlist_item(&id)?;
        self.export_local_tool_portfolio_state(&owner_profile_id)?;
        Ok(item)
    }

    pub fn update_watchlist_item(&self, input: UpdateWatchlistItemInput) -> Result<Value> {
        let owner_profile_id = self
            .profile_id_for_watchlist_item(&input.item_id)?
            .context("watchlist item not found")?;
        if owner_profile_id != input.profile_id {
            bail!("watchlist item outside active profile");
        }
        if let Some(trigger_note) = input.trigger_note {
            self.db.conn.execute(
                "UPDATE watchlist_items SET trigger_note = ?1, updated_at = ?2 WHERE id = ?3",
                params![trigger_note, now(), input.item_id],
            )?;
        }
        if let Some(target_zone) = input.target_zone {
            self.db.conn.execute(
                "UPDATE watchlist_items SET target_zone = ?1, updated_at = ?2 WHERE id = ?3",
                params![target_zone, now(), input.item_id],
            )?;
        }
        let item = self.load_watchlist_item(&input.item_id)?;
        self.export_local_tool_portfolio_state(&owner_profile_id)?;
        Ok(item)
    }
}
