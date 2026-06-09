use std::fs;

use anyhow::{Context, Result};
use rusqlite::params;

use super::database::PlutusDatabase;
use super::models::{
    AppendRunEvent, Artifact, EnqueueLocalJob, FinalOutput, LocalJob, NewResearchRun,
    PersistFinalOutput, ResearchRun, RunEvent, WriteArtifactFile,
};
use super::paths::AppDataPaths;
use super::util::{new_id, now, sha256_hex};

impl PlutusDatabase {
    pub fn create_research_run(&self, input: NewResearchRun) -> Result<ResearchRun> {
        let run = ResearchRun {
            id: new_id(),
            profile_id: input.profile_id,
            portfolio_id: input.portfolio_id,
            status: "queued".to_string(),
            user_request: input.user_request,
            selected_team: input.selected_team,
            codex_thread_id: None,
            workspace_path: format!("runs/{}", new_id()),
            recommendation_category: None,
        };
        self.conn.execute(
            "INSERT INTO research_runs(id, profile_id, portfolio_id, status, user_request, selected_team, codex_thread_id, workspace_path, custom_agent_versions, local_tool_config_hash, model_config, started_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, '{}', 'local-tools-v1', '{}', ?8)",
            params![run.id, run.profile_id, run.portfolio_id, run.status, run.user_request, run.selected_team, run.workspace_path, now()],
        )?;
        Ok(run)
    }

    pub fn append_run_event(&self, input: AppendRunEvent) -> Result<RunEvent> {
        let event = RunEvent {
            id: new_id(),
            research_run_id: input.research_run_id,
            sequence: input.sequence,
            event_type: input.event_type,
            payload: input.payload,
            created_at: now(),
        };
        self.conn.execute(
            "INSERT INTO research_run_events(id, research_run_id, sequence, event_type, payload, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![event.id, event.research_run_id, event.sequence, event.event_type, event.payload.to_string(), event.created_at],
        )?;
        Ok(event)
    }

    pub fn persist_final_output(&self, input: PersistFinalOutput) -> Result<FinalOutput> {
        let output = FinalOutput {
            id: new_id(),
            research_run_id: input.research_run_id,
            summary: input.summary,
            structured_output: input.structured_output,
            created_at: now(),
        };
        self.conn.execute(
            "INSERT INTO research_run_final_outputs(id, research_run_id, summary, structured_output, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![output.id, output.research_run_id, output.summary, output.structured_output.to_string(), output.created_at],
        )?;
        self.conn.execute(
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
        Ok(output)
    }

    pub fn enqueue_local_job(&self, input: EnqueueLocalJob) -> Result<LocalJob> {
        let timestamp = now();
        let job = LocalJob {
            id: new_id(),
            research_run_id: input.research_run_id,
            job_type: input.job_type,
            status: "queued".to_string(),
            payload: input.payload,
            attempts: 0,
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
            available_at: timestamp,
        };
        self.conn.execute(
            "INSERT INTO local_job_queue(id, research_run_id, job_type, status, payload, attempts, created_at, updated_at, available_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![job.id, job.research_run_id, job.job_type, job.status, job.payload.to_string(), job.attempts, job.created_at, job.updated_at, job.available_at],
        )?;
        Ok(job)
    }

    pub fn write_artifact_file(
        &self,
        paths: &AppDataPaths,
        input: WriteArtifactFile,
    ) -> Result<Artifact> {
        let artifact_id = new_id();
        let storage_key = format!("runs/{}/artifacts/{artifact_id}", input.research_run_id);
        let target = paths.root.join(&storage_key);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&target, &input.contents)
            .with_context(|| format!("failed to write artifact {}", target.display()))?;

        let artifact = Artifact {
            id: artifact_id,
            research_run_id: input.research_run_id,
            artifact_type: input.artifact_type,
            title: input.title,
            storage_key,
            content_hash: sha256_hex(&input.contents),
            mime_type: input.mime_type,
        };
        self.conn.execute(
            "INSERT INTO agent_artifacts(id, research_run_id, artifact_type, title, storage_key, content_hash, mime_type, metadata, created_by_agent, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![artifact.id, artifact.research_run_id, artifact.artifact_type, artifact.title, artifact.storage_key, artifact.content_hash, artifact.mime_type, input.metadata.to_string(), input.created_by_agent, now()],
        )?;
        Ok(artifact)
    }
}
