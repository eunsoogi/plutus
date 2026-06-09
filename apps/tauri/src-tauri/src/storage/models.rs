use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Portfolio {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub base_currency: String,
    pub benchmark_id: Option<String>,
    pub risk_profile: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Position {
    pub id: String,
    pub portfolio_id: String,
    pub account_id: String,
    pub instrument_id: String,
    pub quantity: f64,
    pub average_cost: f64,
    pub cost_currency: String,
    pub thesis: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Watchlist {
    pub id: String,
    pub profile_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResearchRun {
    pub id: String,
    pub profile_id: String,
    pub portfolio_id: Option<String>,
    pub status: String,
    pub user_request: String,
    pub selected_team: String,
    pub codex_thread_id: Option<String>,
    pub workspace_path: String,
    pub recommendation_category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RunEvent {
    pub id: String,
    pub research_run_id: String,
    pub sequence: i64,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FinalOutput {
    pub id: String,
    pub research_run_id: String,
    pub summary: String,
    pub structured_output: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LocalJob {
    pub id: String,
    pub research_run_id: Option<String>,
    pub job_type: String,
    pub status: String,
    pub payload: serde_json::Value,
    pub attempts: i64,
    pub created_at: String,
    pub updated_at: String,
    pub available_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Artifact {
    pub id: String,
    pub research_run_id: String,
    pub artifact_type: String,
    pub title: String,
    pub storage_key: String,
    pub content_hash: String,
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewResearchRun {
    pub profile_id: String,
    pub portfolio_id: Option<String>,
    pub user_request: String,
    pub selected_team: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppendRunEvent {
    pub research_run_id: String,
    pub sequence: i64,
    pub event_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistFinalOutput {
    pub research_run_id: String,
    pub summary: String,
    pub structured_output: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnqueueLocalJob {
    pub research_run_id: Option<String>,
    pub job_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteArtifactFile {
    pub research_run_id: String,
    pub artifact_type: String,
    pub title: String,
    pub mime_type: String,
    pub metadata: serde_json::Value,
    pub created_by_agent: String,
    pub contents: Vec<u8>,
}
