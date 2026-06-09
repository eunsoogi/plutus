use anyhow::{bail, Context, Result};
use rusqlite::params;
use serde_json::json;

use crate::storage::PlutusDatabase;

use super::super::authorization::assert_artifact_belongs_to_profile;
use super::super::types::RemoteCommandRequest;

pub(in crate::remote_control) fn get_artifact(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let artifact_id = request
        .payload
        .get("artifactId")
        .and_then(|value| value.as_str())
        .context("artifactId is required")?;
    let run_id = request
        .payload
        .get("runId")
        .and_then(|value| value.as_str());
    Ok(db.conn.query_row(
        "SELECT a.id, a.research_run_id, a.artifact_type, a.title, a.storage_key, a.content_hash, a.mime_type
         FROM agent_artifacts a
         JOIN research_runs r ON r.id = a.research_run_id
         WHERE a.id = ?1 AND r.profile_id = ?2 AND (?3 IS NULL OR a.research_run_id = ?3)",
        params![artifact_id, profile_id, run_id],
        |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "researchRunId": row.get::<_, String>(1)?,
                "artifactType": row.get::<_, String>(2)?,
                "title": row.get::<_, String>(3)?,
                "storageKey": row.get::<_, String>(4)?,
                "contentHash": row.get::<_, String>(5)?,
                "mimeType": row.get::<_, String>(6)?,
            }))
        },
    )?)
}

pub(in crate::remote_control) fn open_local_artifact_file(
    db: &PlutusDatabase,
    request: &RemoteCommandRequest,
    profile_id: &str,
) -> Result<serde_json::Value> {
    let artifact_id = request
        .payload
        .get("artifactId")
        .and_then(|value| value.as_str())
        .context("artifactId is required")?;
    assert_artifact_belongs_to_profile(db, artifact_id, profile_id)?;
    if let Some(run_id) = request
        .payload
        .get("runId")
        .and_then(|value| value.as_str())
    {
        let artifact_run_id: String = db.conn.query_row(
            "SELECT research_run_id FROM agent_artifacts WHERE id = ?1",
            params![artifact_id],
            |row| row.get(0),
        )?;
        if artifact_run_id != run_id {
            bail!("artifact outside requested run");
        }
    }
    Ok(json!({"artifactId": artifact_id, "opened": true}))
}
