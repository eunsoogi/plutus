use anyhow::{Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

use crate::audit::record_audit_event;
use crate::security::redact_secrets;
use crate::storage::{new_id, now};

use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub fn list_wiki_pages(&self, profile_id: &str, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, slug, category, title, summary, freshness, confidence, updated_at FROM wiki_pages WHERE profile_id = ?1 ORDER BY updated_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![profile_id, limit], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "slug": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "title": redact_secrets(&row.get::<_, String>(3)?),
                "summary": row.get::<_, String>(4)?,
                "freshness": row.get::<_, String>(5)?,
                "confidence": row.get::<_, String>(6)?,
                "updatedAt": row.get::<_, String>(7)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn get_wiki_page(&self, page_id: &str, profile_id: &str) -> Result<Value> {
        self.db.conn.query_row(
            "SELECT id, slug, category, title, summary, freshness, confidence, current_revision_id FROM wiki_pages WHERE id = ?1 AND profile_id = ?2",
            params![page_id, profile_id],
            |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "slug": row.get::<_, String>(1)?,
                    "category": row.get::<_, String>(2)?,
                    "title": row.get::<_, String>(3)?,
                    "summary": row.get::<_, String>(4)?,
                    "freshness": row.get::<_, String>(5)?,
                    "confidence": row.get::<_, String>(6)?,
                    "currentRevisionId": row.get::<_, Option<String>>(7)?,
                }))
            },
        ).optional()?.context("wiki page not found")
    }

    pub fn list_wiki_activity(&self, profile_id: &str, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT wr.id, wr.wiki_page_id, wr.revision_number, wr.revision_note, wr.created_by, wr.created_at
             FROM wiki_revisions wr
             JOIN wiki_pages wp ON wp.id = wr.wiki_page_id
             WHERE wp.profile_id = ?1
             ORDER BY wr.created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![profile_id, limit], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "pageId": row.get::<_, String>(1)?,
                "revisionNumber": row.get::<_, i64>(2)?,
                "revisionNote": row.get::<_, String>(3)?,
                "createdBy": row.get::<_, String>(4)?,
                "createdAt": row.get::<_, String>(5)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn revert_wiki_revision(
        &self,
        page_id: &str,
        revision_id: &str,
        reason: &str,
    ) -> Result<Value> {
        let now = now();
        let new_revision_id = new_id();
        let (storage_key, content_hash, source_refs, contradiction_refs, next_revision_number): (
            String,
            String,
            String,
            String,
            i64,
        ) = self
            .db
            .conn
            .query_row(
                "SELECT target.storage_key,
                    target.content_hash,
                    target.source_refs,
                    target.contradiction_refs,
                    COALESCE(MAX(existing.revision_number), 0) + 1
             FROM wiki_revisions target
             JOIN wiki_revisions existing ON existing.wiki_page_id = target.wiki_page_id
             WHERE target.id = ?1 AND target.wiki_page_id = ?2",
                params![revision_id, page_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
            .optional()?
            .context("wiki revision not found")?;
        self.db.conn.execute(
            "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'user', NULL, ?9)",
            params![
                new_revision_id,
                page_id,
                next_revision_number,
                storage_key,
                content_hash,
                format!("Revert: {reason}"),
                source_refs,
                contradiction_refs,
                now,
            ],
        )?;
        self.db.conn.execute(
            "UPDATE wiki_pages SET current_revision_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_revision_id, now, page_id],
        )?;
        record_audit_event(
            self.db,
            None,
            None,
            "user",
            "wiki.revert_revision",
            page_id,
            &json!({"revisionId": revision_id, "newRevisionId": new_revision_id, "reason": reason}),
        )?;
        let profile_id = self
            .profile_id_for_wiki_page(page_id)?
            .context("wiki page not found")?;
        self.get_wiki_page(page_id, &profile_id)
    }
}
