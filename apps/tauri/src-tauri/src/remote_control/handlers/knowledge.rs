use anyhow::{bail, Context, Result};
use rusqlite::params;
use serde_json::json;

use crate::security::redact_secret_values;
use crate::storage::PlutusDatabase;

use super::super::types::RemoteCommandRequest;

pub(in crate::remote_control) fn list_memory_activity(
    db: &PlutusDatabase,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let mut stmt = db.conn.prepare(
        "SELECT ma.id, ma.memory_id, ma.event_type, ma.actor, ma.payload, ma.created_at
         FROM memory_activity ma
         LEFT JOIN memory_records mr ON mr.id = ma.memory_id
         WHERE ma.memory_id IS NULL OR mr.profile_id = ?1
         ORDER BY ma.created_at DESC LIMIT 50",
    )?;
    let rows = stmt.query_map(params![profile_id], |row| {
        let payload = row.get::<_, String>(4)?;
        let payload = serde_json::from_str::<serde_json::Value>(&payload)
            .map(|value| redact_secret_values(&value))
            .unwrap_or_else(|_| redact_secret_values(&json!(payload)));
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "memoryId": row.get::<_, Option<String>>(1)?,
            "eventType": row.get::<_, String>(2)?,
            "actor": row.get::<_, String>(3)?,
            "payload": payload,
            "createdAt": row.get::<_, String>(5)?,
        }))
    })?;
    Ok(json!(rows.collect::<rusqlite::Result<Vec<_>>>()?))
}

pub(in crate::remote_control) fn reject_memory_mutation(
    request: &RemoteCommandRequest,
) -> Result<serde_json::Value> {
    bail!(
        "unsupported remote command {}; memory mutations are Mac-host only",
        request.command_type
    )
}

pub(in crate::remote_control) fn list_wiki_pages(
    db: &PlutusDatabase,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let mut stmt = db.conn.prepare(
        "SELECT id, title, slug, status, updated_at FROM wiki_pages WHERE profile_id = ?1 ORDER BY updated_at DESC LIMIT 50",
    )?;
    let rows = stmt.query_map(params![profile_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "title": row.get::<_, String>(1)?,
            "slug": row.get::<_, String>(2)?,
            "status": row.get::<_, String>(3)?,
            "updatedAt": row.get::<_, String>(4)?,
        }))
    })?;
    Ok(json!(rows.collect::<rusqlite::Result<Vec<_>>>()?))
}

pub(in crate::remote_control) fn get_wiki_page(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let page_id = request
        .payload
        .get("pageId")
        .and_then(|value| value.as_str())
        .context("pageId is required")?;
    Ok(db.conn.query_row(
        "SELECT id, title, slug, status, updated_at FROM wiki_pages WHERE id = ?1 AND profile_id = ?2",
        params![page_id, profile_id],
        |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "slug": row.get::<_, String>(2)?,
                "status": row.get::<_, String>(3)?,
                "updatedAt": row.get::<_, String>(4)?,
            }))
        },
    )?)
}

pub(in crate::remote_control) fn list_wiki_activity(
    db: &PlutusDatabase,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let mut stmt = db.conn.prepare(
        "SELECT wr.id, wr.wiki_page_id, wr.revision_note, wr.created_by, wr.created_at
         FROM wiki_revisions wr
         JOIN wiki_pages wp ON wp.id = wr.wiki_page_id
         WHERE wp.profile_id = ?1
         ORDER BY wr.created_at DESC LIMIT 50",
    )?;
    let rows = stmt.query_map(params![profile_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "pageId": row.get::<_, String>(1)?,
            "eventType": "revision",
            "actor": row.get::<_, String>(3)?,
            "payload": {"revisionNote": row.get::<_, String>(2)?},
            "createdAt": row.get::<_, String>(4)?,
        }))
    })?;
    Ok(json!(rows.collect::<rusqlite::Result<Vec<_>>>()?))
}

pub(in crate::remote_control) fn reject_wiki_mutation(
    request: &RemoteCommandRequest,
) -> Result<serde_json::Value> {
    bail!(
        "unsupported remote command {}; wiki mutations are Mac-host only",
        request.command_type
    )
}
