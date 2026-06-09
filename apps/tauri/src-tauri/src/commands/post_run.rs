use anyhow::{Context, Result};
use rusqlite::params;
use serde_json::{json, Value};
use std::fs;

use crate::storage::{new_id, now, sha256_hex, PlutusDatabase};

use super::PlutusCommands;

fn slug_fragment(value: &str) -> String {
    let slug: String = value
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() {
        "run-card".to_string()
    } else {
        slug
    }
}
fn db_insert_memory(
    db: &PlutusDatabase,
    memory_id: &str,
    profile_id: &str,
    summary: &str,
    kind: &str,
    tags: &Value,
    source_refs: &Value,
    run_id: &str,
    timestamp: &str,
) -> Result<()> {
    db.conn.execute(
        "INSERT INTO memory_records(id, profile_id, mem0_id, kind, summary, tags, source_refs, capture_policy, sensitivity_class, retention_class, status, created_at, updated_at)
         VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, 'auto_default', 'normal', 'default', 'active', ?7, ?7)",
        params![
            memory_id,
            profile_id,
            kind,
            summary,
            tags.to_string(),
            source_refs.to_string(),
            timestamp
        ],
    )?;
    db.conn.execute(
        "INSERT INTO memory_activity(id, memory_id, event_type, actor, research_run_id, audit_ref, payload, created_at)
         VALUES (?1, ?2, 'memory.captured', 'agent:report_writer', ?3, ?4, ?5, ?6)",
        params![
            new_id(),
            memory_id,
            run_id,
            format!("audit:{run_id}:memory"),
            json!({"summary": summary}).to_string(),
            timestamp
        ],
    )?;
    Ok(())
}

impl<'a> PlutusCommands<'a> {
    pub(super) fn persist_post_run_memory_and_wiki(
        &self,
        run_id: &str,
        final_output: Option<&Value>,
    ) -> Result<()> {
        let run = self.get_research_run(run_id)?;
        let timestamp = now();
        let memory_id = new_id();
        let category = final_output
            .and_then(|value| {
                value
                    .get("recommendationCategory")
                    .or_else(|| value.get("category"))
                    .and_then(|category| category.as_str())
            })
            .unwrap_or("risk_warning");
        let title = final_output
            .and_then(|value| value.get("title").and_then(|title| title.as_str()))
            .unwrap_or("BTC/NVDA risk review");
        let summary = final_output
            .and_then(|value| value.get("summary").and_then(|summary| summary.as_str()))
            .unwrap_or("Concentration risk remains elevated; no trade action is authorized.");
        let source_refs = final_output
            .and_then(|value| {
                value
                    .get("evidenceRefs")
                    .or_else(|| value.get("evidence"))
                    .cloned()
            })
            .unwrap_or_else(|| json!([{"type": "run", "id": run_id}]));
        let tags = json!(["run_card", category]);
        db_insert_memory(
            self.db,
            &memory_id,
            &run.profile_id,
            summary,
            category,
            &tags,
            &source_refs,
            run_id,
            &timestamp,
        )?;
        let wiki_id = new_id();
        let revision_id = new_id();
        self.db.conn.execute(
            "INSERT INTO wiki_pages(id, profile_id, slug, category, title, summary, status, current_revision_id, tags, source_refs, memory_refs, freshness, confidence, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'risk_lesson', ?4, ?5, 'active', ?6, ?7, ?8, ?9, 'current', 'medium', ?10, ?10)",
            params![
                wiki_id,
                run.profile_id,
                format!("{}-{run_id}", slug_fragment(title)),
                title,
                summary,
                revision_id,
                tags.to_string(),
                source_refs.to_string(),
                json!([memory_id]).to_string(),
                timestamp
            ],
        )?;
        self.db.conn.execute(
            "INSERT INTO wiki_revisions(id, wiki_page_id, revision_number, storage_key, content_hash, revision_note, source_refs, contradiction_refs, created_by, audit_ref, created_at)
             VALUES (?1, ?2, 1, ?3, ?4, 'Post-run wiki maintenance', ?5, '[]', 'agent:llm_wiki_curator', ?6, ?7)",
            params![
                revision_id,
                wiki_id,
                format!("wiki/{wiki_id}.md"),
                sha256_hex(format!("{run_id}:{memory_id}:{summary}").as_bytes()),
                source_refs.to_string(),
                format!("audit:{run_id}:wiki"),
                timestamp
            ],
        )?;
        if let Some(paths) = self.paths {
            let content =
                format!("# {title}\n\n{summary}\n\nSource run: {run_id}\nMemory: {memory_id}\n");
            fs::write(paths.wiki.join(format!("{wiki_id}.md")), content)
                .with_context(|| format!("failed to write wiki markdown for {wiki_id}"))?;
        }
        Ok(())
    }
}
