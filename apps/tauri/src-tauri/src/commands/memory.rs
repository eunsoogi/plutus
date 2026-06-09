use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

use crate::storage::{new_id, now};

use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub fn list_memory_activity(&self, profile_id: &str, limit: i64) -> Result<Vec<Value>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, memory_id, event_type, actor, research_run_id, payload, created_at
             FROM memory_activity ma
             LEFT JOIN memory_records mr ON mr.id = ma.memory_id
             LEFT JOIN research_runs rr ON rr.id = ma.research_run_id
             WHERE mr.profile_id = ?1 OR rr.profile_id = ?1
             ORDER BY ma.created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![profile_id, limit], |row| {
            let payload: String = row.get(5)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "memoryId": row.get::<_, Option<String>>(1)?,
                "eventType": row.get::<_, String>(2)?,
                "actor": row.get::<_, String>(3)?,
                "researchRunId": row.get::<_, Option<String>>(4)?,
                "payload": serde_json::from_str::<Value>(&payload).unwrap_or_else(|_| json!({})),
                "createdAt": row.get::<_, String>(6)?,
            }))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn update_memory(&self, memory_id: &str, profile_id: &str, patch: Value) -> Result<Value> {
        self.load_memory_for_profile(memory_id, profile_id)?;
        let summary = patch.get("summary").and_then(|value| value.as_str());
        let status = patch.get("status").and_then(|value| value.as_str());
        if let Some(summary) = summary {
            self.db.conn.execute(
                "UPDATE memory_records SET summary = ?1, updated_at = ?2 WHERE id = ?3 AND profile_id = ?4",
                params![summary, now(), memory_id, profile_id],
            )?;
        }
        if let Some(status) = status {
            self.db.conn.execute(
                "UPDATE memory_records SET status = ?1, updated_at = ?2 WHERE id = ?3 AND profile_id = ?4",
                params![status, now(), memory_id, profile_id],
            )?;
        }
        self.record_memory_activity(Some(memory_id), "memory.updated", patch)?;
        self.load_memory_for_profile(memory_id, profile_id)
    }

    pub fn archive_memory(&self, memory_id: &str, profile_id: &str, reason: &str) -> Result<()> {
        self.load_memory_for_profile(memory_id, profile_id)?;
        self.db.conn.execute(
            "UPDATE memory_records SET status = 'archived', retention_class = 'archived', updated_at = ?1 WHERE id = ?2 AND profile_id = ?3",
            params![now(), memory_id, profile_id],
        )?;
        self.record_memory_activity(
            Some(memory_id),
            "memory.archived",
            json!({"reason": reason}),
        )?;
        Ok(())
    }

    pub fn forget_memory(&self, memory_id: &str, profile_id: &str) -> Result<()> {
        self.load_memory_for_profile(memory_id, profile_id)?;
        self.db.conn.execute(
            "UPDATE memory_records SET status = 'deleted', deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND profile_id = ?3",
            params![now(), memory_id, profile_id],
        )?;
        self.record_memory_activity(Some(memory_id), "memory.deleted", json!({}))?;
        Ok(())
    }

    pub fn set_memory_category_enabled(&self, category: &str, enabled: bool) -> Result<()> {
        self.record_memory_activity(
            None,
            "memory.category_enabled",
            json!({"category": category, "enabled": enabled}),
        )?;
        Ok(())
    }

    pub(super) fn record_memory_activity(
        &self,
        memory_id: Option<&str>,
        event_type: &str,
        payload: Value,
    ) -> Result<()> {
        self.db.conn.execute(
            "INSERT INTO memory_activity(id, memory_id, event_type, actor, research_run_id, audit_ref, payload, created_at)
             VALUES (?1, ?2, ?3, 'user', NULL, NULL, ?4, ?5)",
            params![new_id(), memory_id, event_type, payload.to_string(), now()],
        )?;
        Ok(())
    }

    pub(super) fn load_memory(&self, memory_id: &str) -> Result<Value> {
        self.db.conn.query_row(
            "SELECT id, profile_id, mem0_id, kind, summary, tags, status, updated_at FROM memory_records WHERE id = ?1",
            params![memory_id],
            |row| {
                let tags: String = row.get(5)?;
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "profileId": row.get::<_, String>(1)?,
                    "mem0Id": row.get::<_, Option<String>>(2)?,
                    "kind": row.get::<_, String>(3)?,
                    "summary": row.get::<_, String>(4)?,
                    "tags": serde_json::from_str::<Value>(&tags).unwrap_or_else(|_| json!([])),
                    "status": row.get::<_, String>(6)?,
                    "updatedAt": row.get::<_, String>(7)?,
                }))
            },
        ).optional()?.context("memory not found")
    }

    pub(super) fn load_memory_for_profile(
        &self,
        memory_id: &str,
        profile_id: &str,
    ) -> Result<Value> {
        let memory = self.load_memory(memory_id)?;
        if memory.get("profileId").and_then(|value| value.as_str()) != Some(profile_id) {
            bail!("memory outside active profile");
        }
        Ok(memory)
    }
}
