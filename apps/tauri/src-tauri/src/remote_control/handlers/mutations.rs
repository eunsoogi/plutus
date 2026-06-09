use anyhow::{bail, Context, Result};
use rusqlite::params;
use serde_json::json;

use crate::storage::{now, PlutusDatabase};

use super::super::types::RemoteCommandRequest;

pub(in crate::remote_control) fn update_position_thesis(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let position_id = request
        .payload
        .get("positionId")
        .and_then(|value| value.as_str())
        .context("positionId is required")?;
    let thesis = request
        .payload
        .get("thesis")
        .and_then(|value| value.as_str())
        .context("thesis is required")?;
    let affected = db.conn.execute(
        "UPDATE positions SET thesis = ?1, updated_at = ?2
         WHERE id = ?3 AND portfolio_id IN (SELECT id FROM portfolios WHERE profile_id = ?4)",
        params![thesis, now(), position_id, profile_id],
    )?;
    if affected == 0 {
        bail!("position not found for paired profile");
    }
    Ok(json!({"positionId": position_id, "thesis": thesis}))
}

pub(in crate::remote_control) fn update_watchlist_item(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let item_id = request
        .payload
        .get("itemId")
        .and_then(|value| value.as_str())
        .context("itemId is required")?;
    let note = request
        .payload
        .get("triggerNote")
        .and_then(|value| value.as_str())
        .context("triggerNote is required")?;
    let affected = db.conn.execute(
        "UPDATE watchlist_items SET trigger_note = ?1, updated_at = ?2
         WHERE id = ?3 AND watchlist_id IN (SELECT id FROM watchlists WHERE profile_id = ?4)",
        params![note, now(), item_id, profile_id],
    )?;
    if affected == 0 {
        bail!("watchlist item not found for paired profile");
    }
    Ok(json!({"itemId": item_id, "updated": true}))
}
