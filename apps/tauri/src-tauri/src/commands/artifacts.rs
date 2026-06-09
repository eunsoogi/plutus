use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

use crate::audit::record_audit_event;
use crate::storage::{now, Artifact};

use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub fn get_artifact(&self, artifact_id: &str) -> Result<Artifact> {
        self.db
            .conn
            .query_row(
                "SELECT id, research_run_id, artifact_type, title, storage_key, content_hash, mime_type FROM agent_artifacts WHERE id = ?1",
                params![artifact_id],
                |row| {
                    Ok(Artifact {
                        id: row.get(0)?,
                        research_run_id: row.get(1)?,
                        artifact_type: row.get(2)?,
                        title: row.get(3)?,
                        storage_key: row.get(4)?,
                        content_hash: row.get(5)?,
                        mime_type: row.get(6)?,
                    })
                },
            )
            .optional()?
            .context("artifact not found")
    }

    pub fn get_artifact_for_profile(
        &self,
        artifact_id: &str,
        profile_id: &str,
    ) -> Result<Artifact> {
        let artifact = self.get_artifact(artifact_id)?;
        let run = self.get_research_run(&artifact.research_run_id)?;
        if run.profile_id != profile_id {
            bail!("artifact outside active profile");
        }
        Ok(artifact)
    }

    pub fn get_artifact_for_profile_and_run(
        &self,
        artifact_id: &str,
        profile_id: &str,
        run_id: Option<&str>,
    ) -> Result<Artifact> {
        let artifact = self.get_artifact_for_profile(artifact_id, profile_id)?;
        if let Some(run_id) = run_id {
            if artifact.research_run_id != run_id {
                bail!("artifact outside requested run");
            }
        }
        Ok(artifact)
    }

    pub(super) fn artifact_ref_exists(&self, run_id: &str, artifact_ref: &str) -> Result<bool> {
        let count: i64 = self.db.conn.query_row(
            "SELECT COUNT(*) FROM agent_artifacts WHERE research_run_id = ?1 AND (id = ?2 OR title = ?2 OR storage_key = ?2)",
            params![run_id, artifact_ref],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn open_local_artifact_file(&self, artifact_id: &str) -> Result<Value> {
        let artifact = self.get_artifact(artifact_id)?;
        let path = self
            .paths
            .map(|paths| paths.root.join(&artifact.storage_key).display().to_string())
            .unwrap_or(artifact.storage_key);
        record_audit_event(
            self.db,
            None,
            Some(&artifact.research_run_id),
            "user",
            "artifact.open_local_file",
            artifact_id,
            &json!({"path": path}),
        )?;
        Ok(json!({"opened": true, "path": path, "hostTimestamp": now()}))
    }

    pub fn open_local_artifact_file_for_profile(
        &self,
        artifact_id: &str,
        profile_id: &str,
        run_id: Option<&str>,
    ) -> Result<Value> {
        self.get_artifact_for_profile_and_run(artifact_id, profile_id, run_id)?;
        self.open_local_artifact_file(artifact_id)
    }
}
