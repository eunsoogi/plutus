use anyhow::Result;
use rusqlite::params;
use serde_json::json;

use crate::storage::{now, AppendRunEvent, PersistFinalOutput, WriteArtifactFile};

use super::PlutusCommands;

impl<'a> PlutusCommands<'a> {
    pub(super) fn persist_deterministic_run_completion(&self, run_id: &str) -> Result<()> {
        for (sequence, event_type, payload) in [
            (
                2,
                "stage.started",
                json!({"stage": "plan", "agent": "portfolio_manager"}),
            ),
            (
                3,
                "stage.completed",
                json!({"stage": "ground", "agent": "market_data_researcher"}),
            ),
            (
                4,
                "stage.completed",
                json!({"stage": "execute", "agent": "risk_manager"}),
            ),
            (
                5,
                "run.completed",
                json!({"recommendationCategory": "risk_warning"}),
            ),
        ] {
            self.db.append_run_event(AppendRunEvent {
                research_run_id: run_id.to_string(),
                sequence,
                event_type: event_type.to_string(),
                payload,
            })?;
        }
        self.db.persist_final_output(PersistFinalOutput {
            research_run_id: run_id.to_string(),
            summary: "BTC/NVDA review completed with risk warning: concentration remains elevated and no trade action is authorized.".to_string(),
            structured_output: json!({
                "category": "risk_warning",
                "title": "BTC/NVDA risk review",
                "userRequest": "Review BTC/NVDA exposure and identify risk inspection steps.",
                "selectedTeam": "portfolio_review_committee",
                "riskValidation": "vetoed",
                "summary": "BTC/NVDA review completed with risk warning: concentration remains elevated and no trade action is authorized.",
                "confidence": "medium",
                "warnings": [
                    "BTC and NVDA concentration remains elevated.",
                    "No live trading action is authorized."
                ],
                "evidenceRefs": ["portfolio:core"],
                "supportingEvidence": [
                    {"label": "BTC/NVDA concentration", "sourceRef": "portfolio:core"}
                ],
                "freshness": {"delayStatus": "delayed"},
                "caveats": ["Past performance is not indicative of future results."],
                "assumptions": ["Portfolio data is current enough for a risk review."],
                "dissentingViews": ["No dissenting view recorded."],
                "riskChecklist": [
                    {"check": "Concentration", "status": "warning", "evidenceRefs": ["portfolio:core"]}
                ],
                "artifacts": [],
                "artifactRefs": [],
                "limitations": ["Read-only review; no trade execution is authorized."],
                "nextActions": ["Refresh market data before making allocation decisions."],
                "approvalRequired": true,
                "findings": [
                    "BTC and NVDA concentration remains elevated.",
                    "Past performance is not indicative of future results.",
                    "No live trading action is authorized."
                ],
                "riskVeto": true
            }),
        })?;
        self.persist_post_run_memory_and_wiki(run_id, None)?;
        let artifact = b"# BTC/NVDA risk review\n\nRisk warning: concentration remains elevated. No trade action is authorized.\n";
        if let Some(paths) = self.paths {
            self.db.write_artifact_file(
                paths,
                WriteArtifactFile {
                    research_run_id: run_id.to_string(),
                    artifact_type: "run_card".to_string(),
                    title: "BTC/NVDA risk review".to_string(),
                    mime_type: "text/markdown".to_string(),
                    metadata: json!({"category": "risk_warning"}),
                    created_by_agent: "report_writer".to_string(),
                    contents: artifact.to_vec(),
                },
            )?;
        }
        self.db.conn.execute(
            "UPDATE research_runs SET status = 'completed', recommendation_category = 'risk_warning', completed_at = ?1 WHERE id = ?2",
            params![now(), run_id],
        )?;
        Ok(())
    }
}
