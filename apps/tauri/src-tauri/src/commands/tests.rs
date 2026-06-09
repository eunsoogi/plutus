use super::*;
pub(super) use crate::remote_control::{
    execute_authorized_remote_command, pair_device, RemoteCommandRequest,
};
pub(super) use crate::secure_store::SecureStore;
pub(super) use crate::storage::{
    new_id, now, NewResearchRun, PersistFinalOutput, PlutusDatabase, WriteArtifactFile, MVP_BTC_ID,
    MVP_PORTFOLIO_ID, MVP_PROFILE_ID, MVP_WATCHLIST_ID,
};
pub(super) use rusqlite::params;
use serde_json::{json, Value};
pub(super) use std::fs;
use std::process::{Command, Stdio};

pub(super) use super::runtime::spawn_codex_runtime_stream_consumer;

fn valid_final_card(summary: &str, category: &str) -> Value {
    json!({
        "title": summary,
        "recommendationCategory": category,
        "userRequest": "Review BTC/NVDA exposure and identify risk inspection steps.",
        "selectedTeam": "portfolio_review_committee",
        "riskValidation": "approved_with_warnings",
        "summary": summary,
        "confidence": "medium",
        "warnings": ["Review concentration risk before acting."],
        "evidenceRefs": ["portfolio:core"],
        "supportingEvidence": [
            {"label": "Core portfolio", "sourceRef": "portfolio:core"}
        ],
        "freshness": {"delayStatus": "delayed"},
        "caveats": ["Not investment advice."],
        "assumptions": ["Portfolio data is current enough for review."],
        "dissentingViews": ["No dissenting view recorded."],
        "riskChecklist": [
            {"check": "Concentration", "status": "warning", "evidenceRefs": ["portfolio:core"]}
        ],
        "artifacts": [],
        "artifactRefs": [],
        "limitations": ["Read-only review; no trade execution authorized."],
        "nextActions": ["Refresh stale quote inputs before action."],
        "approvalRequired": true
    })
}

fn spawn_finished_child(exit_code: i32) -> std::process::Child {
    Command::new("sh")
        .arg("-c")
        .arg(format!("exit {exit_code}"))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap()
}

mod final_output;
mod final_output_artifacts;
mod lifecycle;
mod memory_snapshot;
mod runtime;
mod scope;
mod snapshot_redaction;
