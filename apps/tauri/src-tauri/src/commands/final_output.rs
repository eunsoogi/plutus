use anyhow::{bail, Context, Result};
use rusqlite::params;
use serde_json::json;
use std::fs;

use crate::audit::record_audit_event;
use crate::storage::{new_id, now, FinalOutput, PersistFinalOutput, WriteArtifactFile};

use super::validation::{
    artifact_path_for_ref, validate_final_output, validate_relative_artifact_path,
};
use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub fn persist_validated_final_output(&self, input: PersistFinalOutput) -> Result<FinalOutput> {
        let mut structured = input.structured_output;
        if structured.get("recommendationCategory").is_none() {
            if let Some(category) = structured.get("category").cloned() {
                structured["recommendationCategory"] = category;
            }
        }
        let run_id = input.research_run_id.clone();
        let profile_id: String = self.db.conn.query_row(
            "SELECT profile_id FROM research_runs WHERE id = ?1",
            params![run_id],
            |row| row.get(0),
        )?;
        structured["runId"] = json!(run_id.clone());
        structured["profileId"] = json!(profile_id);
        validate_final_output(&mut structured)?;
        let mut artifact_path_contents: Vec<(String, Vec<u8>)> = Vec::new();
        if let Some(artifact_paths) = structured
            .get("artifactPaths")
            .and_then(|value| value.as_array())
        {
            let paths = self
                .paths
                .context("final output artifactPaths require app data paths")?;
            let workspace = paths.run_workspaces.join(&run_id);
            let canonical_workspace = workspace
                .canonicalize()
                .with_context(|| format!("run workspace not found: {}", workspace.display()))?;
            for value in artifact_paths {
                let path = value
                    .as_str()
                    .context("final output artifactPaths must contain string values")?;
                let relative = validate_relative_artifact_path(path)?;
                let source = workspace.join(&relative);
                let canonical_source = source
                    .canonicalize()
                    .with_context(|| format!("final output artifact path not found: {path}"))?;
                if !canonical_source.starts_with(&canonical_workspace) {
                    bail!("final output artifact path escapes run workspace: {path}");
                }
                let contents = fs::read(&canonical_source).with_context(|| {
                    format!(
                        "failed to read final output artifact {}",
                        canonical_source.display()
                    )
                })?;
                artifact_path_contents.push((path.to_string(), contents));
            }
        }
        if let Some(refs) = structured
            .get("artifactRefs")
            .and_then(|value| value.as_array())
        {
            for value in refs {
                let artifact_ref = value
                    .as_str()
                    .context("final output artifactRefs must contain string values")?;
                if self.artifact_ref_exists(&run_id, artifact_ref)? {
                    continue;
                }
                let artifact_path =
                    artifact_path_for_ref(&structured, artifact_ref).with_context(|| {
                        format!("final output artifactRef not found: {artifact_ref}")
                    })?;
                let paths = self
                    .paths
                    .context("final output artifact refs with paths require app data paths")?;
                let workspace = paths.run_workspaces.join(&run_id);
                let canonical_workspace = workspace
                    .canonicalize()
                    .with_context(|| format!("run workspace not found: {}", workspace.display()))?;
                let relative = validate_relative_artifact_path(&artifact_path)?;
                let source = workspace.join(&relative);
                let canonical_source = source.canonicalize().with_context(|| {
                    format!("final output artifact path not found: {artifact_path}")
                })?;
                if !canonical_source.starts_with(&canonical_workspace) {
                    bail!("final output artifact path escapes run workspace: {artifact_path}");
                }
                let contents = fs::read(&canonical_source).with_context(|| {
                    format!(
                        "failed to read final output artifact {}",
                        canonical_source.display()
                    )
                })?;
                artifact_path_contents.push((artifact_path, contents));
            }
        }
        let normalized_input = PersistFinalOutput {
            research_run_id: run_id,
            summary: input.summary,
            structured_output: structured.clone(),
        };
        let output = FinalOutput {
            id: new_id(),
            research_run_id: normalized_input.research_run_id,
            summary: normalized_input.summary,
            structured_output: normalized_input.structured_output,
            created_at: now(),
        };
        self.db.conn.execute("BEGIN IMMEDIATE", [])?;
        let persist_result = (|| -> Result<()> {
            if let Some(paths) = self.paths {
                for (path, contents) in artifact_path_contents {
                    self.db.write_artifact_file(
                        paths,
                        WriteArtifactFile {
                            research_run_id: output.research_run_id.clone(),
                            artifact_type: "final_output_path".to_string(),
                            title: path.to_string(),
                            mime_type: "application/octet-stream".to_string(),
                            metadata: json!({"source": "final_output", "sourcePath": path}),
                            created_by_agent: "report_writer".to_string(),
                            contents,
                        },
                    )?;
                }
            }
            self.persist_post_run_memory_and_wiki(
                &output.research_run_id,
                Some(&output.structured_output),
            )?;
            record_audit_event(
                self.db,
                None,
                Some(&output.research_run_id),
                "system",
                "research_run.final_output",
                &output.id,
                &json!({"recommendationCategory": output.structured_output.get("recommendationCategory")}),
            )?;
            self.db.conn.execute(
                "INSERT INTO research_run_final_outputs(id, research_run_id, summary, structured_output, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    output.id,
                    output.research_run_id,
                    output.summary,
                    output.structured_output.to_string(),
                    output.created_at
                ],
            )?;
            self.db.conn.execute(
                "UPDATE research_runs SET status = 'completed', completed_at = ?1, recommendation_category = ?2 WHERE id = ?3",
                params![
                    output.created_at,
                    output
                        .structured_output
                        .get("recommendationCategory")
                        .and_then(|value| value.as_str()),
                    output.research_run_id
                ],
            )?;
            Ok(())
        })();
        if let Err(error) = persist_result {
            let _ = self.db.conn.execute("ROLLBACK", []);
            return Err(error);
        }
        self.db.conn.execute("COMMIT", [])?;
        Ok(output)
    }
}
