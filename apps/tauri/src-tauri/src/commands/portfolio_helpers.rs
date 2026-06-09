use anyhow::{Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

use crate::storage::Position;

use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub(super) fn resolve_instrument_id(&self, symbol: &str) -> Result<String> {
        self.db
            .conn
            .query_row(
                "SELECT id FROM instruments WHERE display_symbol = ?1 OR canonical_symbol = ?1 LIMIT 1",
                params![symbol],
                |row| row.get(0),
            )
            .optional()?
            .with_context(|| format!("instrument not found for symbol {symbol}"))
    }

    pub(super) fn load_position(&self, position_id: &str) -> Result<Position> {
        self.db
            .conn
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

    pub(super) fn load_watchlist_item(&self, item_id: &str) -> Result<Value> {
        self.db
            .conn
            .query_row(
                "SELECT wi.id, wi.watchlist_id, i.display_symbol, wi.trigger_note, wi.target_zone
             FROM watchlist_items wi JOIN instruments i ON i.id = wi.instrument_id
             WHERE wi.id = ?1",
                params![item_id],
                |row| {
                    Ok(json!({
                        "id": row.get::<_, String>(0)?,
                        "watchlistId": row.get::<_, String>(1)?,
                        "symbol": row.get::<_, String>(2)?,
                        "triggerNote": row.get::<_, String>(3)?,
                        "targetZone": row.get::<_, String>(4)?,
                    }))
                },
            )
            .optional()?
            .context("watchlist item not found")
    }

    pub(super) fn profile_id_for_portfolio(&self, portfolio_id: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT profile_id FROM portfolios WHERE id = ?1",
                params![portfolio_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }

    pub(super) fn profile_id_for_watchlist(&self, watchlist_id: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT profile_id FROM watchlists WHERE id = ?1",
                params![watchlist_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }

    pub(super) fn profile_id_for_watchlist_item(&self, item_id: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT w.profile_id FROM watchlist_items wi JOIN watchlists w ON w.id = wi.watchlist_id WHERE wi.id = ?1",
                params![item_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }

    pub(super) fn profile_id_for_wiki_page(&self, page_id: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT profile_id FROM wiki_pages WHERE id = ?1",
                params![page_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }
}
