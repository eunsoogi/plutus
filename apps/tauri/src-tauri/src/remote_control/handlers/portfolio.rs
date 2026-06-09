use anyhow::Result;
use rusqlite::params;
use serde_json::json;

use crate::storage::PlutusDatabase;

pub(in crate::remote_control) fn list_portfolios(
    db: &PlutusDatabase,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let mut stmt = db.conn.prepare(
        "SELECT id, profile_id, name, base_currency FROM portfolios WHERE profile_id = ?1 ORDER BY name",
    )?;
    let rows = stmt.query_map(params![profile_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "profileId": row.get::<_, String>(1)?,
            "name": row.get::<_, String>(2)?,
            "baseCurrency": row.get::<_, String>(3)?,
        }))
    })?;
    Ok(json!(rows.collect::<rusqlite::Result<Vec<_>>>()?))
}

pub(in crate::remote_control) fn list_watchlists(
    db: &PlutusDatabase,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let mut stmt = db.conn.prepare(
        "SELECT id, profile_id, name FROM watchlists WHERE profile_id = ?1 ORDER BY name",
    )?;
    let rows = stmt.query_map(params![profile_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "profileId": row.get::<_, String>(1)?,
            "name": row.get::<_, String>(2)?,
        }))
    })?;
    Ok(json!(rows.collect::<rusqlite::Result<Vec<_>>>()?))
}
