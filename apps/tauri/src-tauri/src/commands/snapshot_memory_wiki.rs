use anyhow::Result;
use rusqlite::params;
use serde_json::{json, Value};
use std::fs;

use crate::security::{redact_secret_values, redact_secrets};
use crate::storage::now;

use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub(super) fn load_memory_activity_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT ma.id, ma.memory_id, ma.event_type, ma.actor, ma.research_run_id, ma.payload, ma.created_at
             FROM memory_activity ma
             LEFT JOIN memory_records mr ON mr.id = ma.memory_id
             LEFT JOIN research_runs rr ON rr.id = ma.research_run_id
             WHERE mr.profile_id = ?1 OR rr.profile_id = ?1
             ORDER BY ma.created_at DESC
             LIMIT 50",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let payload: String = row.get(5)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "memoryId": row.get::<_, Option<String>>(1)?,
                "eventType": row.get::<_, String>(2)?,
                "actor": row.get::<_, String>(3)?,
                "researchRunId": row.get::<_, Option<String>>(4)?,
                "payload": redact_secret_values(
                    &serde_json::from_str::<Value>(&payload).unwrap_or_else(|_| json!({}))
                ),
                "createdAt": row.get::<_, String>(6)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub(super) fn load_wiki_pages_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT wp.id, wp.slug, wp.category, wp.title, wp.summary, wp.freshness, wp.confidence, wp.current_revision_id, wp.source_refs, wp.updated_at, wr.revision_note
             FROM wiki_pages wp
             LEFT JOIN wiki_revisions wr ON wr.id = wp.current_revision_id
             WHERE wp.profile_id = ?1
             ORDER BY wp.updated_at DESC
             LIMIT 50",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let source_refs: String = row.get(8)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "slug": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "title": redact_secrets(&row.get::<_, String>(3)?),
                "summary": redact_secrets(&row.get::<_, String>(4)?),
                "freshness": row.get::<_, String>(5)?,
                "confidence": row.get::<_, String>(6)?,
                "currentRevisionId": row.get::<_, Option<String>>(7)?,
                "sourceRefs": redact_secret_values(
                    &serde_json::from_str::<Value>(&source_refs).unwrap_or_else(|_| json!([]))
                ),
                "revisionNote": row.get::<_, Option<String>>(10)?.map(|note| redact_secrets(&note)),
                "updatedAt": row.get::<_, String>(9)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub(super) fn export_local_tool_portfolio_state(&self, profile_id: &str) -> Result<()> {
        let Some(paths) = self.paths else {
            return Ok(());
        };
        let mut portfolio_stmt = self.db.conn.prepare(
            "SELECT id, profile_id, name, base_currency, benchmark_id FROM portfolios WHERE profile_id = ?1 ORDER BY name",
        )?;
        let portfolios = portfolio_stmt
            .query_map(params![profile_id], |row| {
                let portfolio_id: String = row.get(0)?;
                let mut position_stmt = self.db.conn.prepare(
                    "SELECT p.id, p.portfolio_id, p.account_id, p.instrument_id, i.display_symbol, p.quantity, p.average_cost, p.cost_currency, p.thesis
                     FROM positions p JOIN instruments i ON i.id = p.instrument_id
                     WHERE p.portfolio_id = ?1 ORDER BY i.display_symbol",
                )?;
                let positions = position_stmt
                    .query_map(params![portfolio_id], |position_row| {
                        Ok(json!({
                            "id": position_row.get::<_, String>(0)?,
                            "portfolioId": position_row.get::<_, String>(1)?,
                            "accountId": position_row.get::<_, String>(2)?,
                            "instrumentId": position_row.get::<_, String>(3)?,
                            "symbol": position_row.get::<_, String>(4)?,
                            "quantity": position_row.get::<_, f64>(5)?,
                            "averageCost": position_row.get::<_, f64>(6)?,
                            "costCurrency": position_row.get::<_, String>(7)?,
                            "thesis": redact_secrets(&position_row.get::<_, String>(8)?),
                            "riskBucket": "core",
                            "tags": [],
                            "acquiredAt": "2026-01-01",
                        }))
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(json!({
                    "id": portfolio_id,
                    "profileId": row.get::<_, String>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "baseCurrency": row.get::<_, String>(3)?,
                    "benchmarkId": row.get::<_, Option<String>>(4)?,
                    "positions": positions,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut watchlist_stmt = self.db.conn.prepare(
            "SELECT id, profile_id, name FROM watchlists WHERE profile_id = ?1 ORDER BY name",
        )?;
        let watchlists = watchlist_stmt
            .query_map(params![profile_id], |row| {
                let watchlist_id: String = row.get(0)?;
                let mut item_stmt = self.db.conn.prepare(
                    "SELECT wi.id, wi.watchlist_id, i.id, i.display_symbol, wi.trigger_note, wi.target_zone
                     FROM watchlist_items wi JOIN instruments i ON i.id = wi.instrument_id
                     WHERE wi.watchlist_id = ?1 ORDER BY i.display_symbol",
                )?;
                let items = item_stmt
                    .query_map(params![watchlist_id], |item_row| {
                        Ok(json!({
                            "id": item_row.get::<_, String>(0)?,
                            "watchlistId": item_row.get::<_, String>(1)?,
                            "instrumentId": item_row.get::<_, String>(2)?,
                            "symbol": item_row.get::<_, String>(3)?,
                            "triggerNote": redact_secrets(&item_row.get::<_, String>(4)?),
                            "targetZone": redact_secrets(&item_row.get::<_, String>(5)?),
                        }))
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(json!({
                    "id": watchlist_id,
                    "profileId": row.get::<_, String>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "items": items,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let dir = paths.root.join("local-tools");
        fs::create_dir_all(&dir)?;
        fs::write(
            dir.join("portfolio-state.json"),
            serde_json::to_vec_pretty(&json!({
                "profileId": profile_id,
                "portfolios": portfolios,
                "watchlists": watchlists,
                "exportedAt": now(),
            }))?,
        )?;
        Ok(())
    }
}
