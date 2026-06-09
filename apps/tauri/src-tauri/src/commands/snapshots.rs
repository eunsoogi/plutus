use anyhow::Result;
use rusqlite::params;
use serde_json::{json, Value};

use crate::remote_control::list_devices;
use crate::security::{redact_secret_values, redact_secrets};

use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub fn get_app_snapshot(&self, profile_id: &str) -> Result<Value> {
        self.db.ensure_default_profile()?;
        Ok(json!({
            "profileId": profile_id,
            "portfolios": self.load_portfolios_for_snapshot(profile_id)?,
            "watchlists": self.load_watchlists_for_snapshot(profile_id)?,
            "runs": self.load_runs_for_snapshot(profile_id)?,
            "artifacts": self.load_artifacts_for_snapshot(profile_id)?,
            "memoryActivity": self.load_memory_activity_for_snapshot(profile_id)?,
            "wikiPages": self.load_wiki_pages_for_snapshot(profile_id)?,
            "remoteDevices": list_devices(self.db, profile_id)?,
        }))
    }

    fn load_portfolios_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, profile_id, name, base_currency, benchmark_id FROM portfolios WHERE profile_id = ?1 ORDER BY updated_at DESC, name",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let portfolio_id: String = row.get(0)?;
            let mut position_stmt = self.db.conn.prepare(
                "SELECT p.id, i.display_symbol, i.name, p.quantity, p.average_cost, p.cost_currency, p.thesis
                 FROM positions p
                 JOIN instruments i ON i.id = p.instrument_id
                 WHERE p.portfolio_id = ?1
                 ORDER BY i.display_symbol",
            )?;
            let positions = position_stmt
                .query_map(params![portfolio_id], |position_row| {
                    Ok(json!({
                        "id": position_row.get::<_, String>(0)?,
                        "symbol": position_row.get::<_, String>(1)?,
                        "name": position_row.get::<_, String>(2)?,
                        "quantity": position_row.get::<_, f64>(3)?,
                        "averageCost": position_row.get::<_, f64>(4)?,
                        "costCurrency": position_row.get::<_, String>(5)?,
                        "thesis": redact_secrets(&position_row.get::<_, String>(6)?),
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
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn load_watchlists_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, profile_id, name FROM watchlists WHERE profile_id = ?1 ORDER BY updated_at DESC, name",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let watchlist_id: String = row.get(0)?;
            let mut item_stmt = self.db.conn.prepare(
                "SELECT wi.id, i.display_symbol, wi.trigger_note, wi.target_zone
                 FROM watchlist_items wi
                 JOIN instruments i ON i.id = wi.instrument_id
                 WHERE wi.watchlist_id = ?1
                 ORDER BY i.display_symbol",
            )?;
            let items = item_stmt
                .query_map(params![watchlist_id], |item_row| {
                    Ok(json!({
                        "id": item_row.get::<_, String>(0)?,
                        "symbol": item_row.get::<_, String>(1)?,
                        "triggerNote": redact_secrets(&item_row.get::<_, String>(2)?),
                        "targetZone": redact_secrets(&item_row.get::<_, String>(3)?),
                    }))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(json!({
                "id": watchlist_id,
                "profileId": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "items": items,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn load_runs_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT rr.id, rr.profile_id, rr.portfolio_id, rr.status, rr.user_request, rr.selected_team, rr.recommendation_category, rr.confidence, rr.started_at, rr.completed_at,
                    (
                        SELECT rfo.structured_output
                        FROM research_run_final_outputs rfo
                        WHERE rfo.research_run_id = rr.id
                        ORDER BY rfo.created_at DESC
                        LIMIT 1
                    )
             FROM research_runs
             rr
             WHERE rr.profile_id = ?1
             ORDER BY rr.started_at DESC
             LIMIT 25",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            let final_card_raw: Option<String> = row.get(10)?;
            let final_card = final_card_raw
                .as_deref()
                .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
                .map(|value| redact_secret_values(&value));
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "profileId": row.get::<_, String>(1)?,
                "portfolioId": row.get::<_, Option<String>>(2)?,
                "status": row.get::<_, String>(3)?,
                "title": row.get::<_, String>(4)?,
                "selectedTeam": row.get::<_, String>(5)?,
                "category": row.get::<_, Option<String>>(6)?,
                "confidence": row.get::<_, Option<String>>(7)?,
                "startedAt": row.get::<_, String>(8)?,
                "completedAt": row.get::<_, Option<String>>(9)?,
                "finalCard": final_card,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn load_artifacts_for_snapshot(&self, profile_id: &str) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT a.id, a.research_run_id, a.artifact_type, a.title, a.mime_type, a.created_at
             FROM agent_artifacts a
             JOIN research_runs r ON r.id = a.research_run_id
             WHERE r.profile_id = ?1
             ORDER BY a.created_at DESC
             LIMIT 50",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "researchRunId": row.get::<_, String>(1)?,
                "type": row.get::<_, String>(2)?,
                "title": redact_secrets(&row.get::<_, String>(3)?),
                "mimeType": row.get::<_, String>(4)?,
                "createdAt": row.get::<_, String>(5)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }
}
