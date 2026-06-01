use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingWarning {
    pub code: String,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingProviderConfig {
    pub provider_id: String,
    pub display_name: String,
    pub market: String,
    pub region: String,
    pub environment: String,
    pub mode: String,
    pub permissions: Vec<String>,
    pub health: String,
    pub last_checked_at: String,
    pub credential_ref: Option<String>,
    pub warnings: Vec<TradingWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingOrderIntent {
    pub provider_id: String,
    pub symbol: String,
    pub side: String,
    pub order_type: String,
    pub quantity: f64,
    pub limit_price: Option<f64>,
    pub quote_currency: String,
    pub rationale: Option<String>,
    pub live_requested: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingAgentView {
    pub role: String,
    pub stance: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingDecision {
    pub decision_id: String,
    pub provider: TradingProviderConfig,
    pub intent: TradingOrderIntent,
    pub final_action: String,
    pub confidence: String,
    pub agent_views: Vec<TradingAgentView>,
    pub blocking_reasons: Vec<String>,
    pub evidence_refs: Vec<String>,
    pub warnings: Vec<TradingWarning>,
    pub approval_required: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingDecisionInput {
    pub provider: TradingProviderConfig,
    pub intent: TradingOrderIntent,
    pub decision: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DryRunOrderResult {
    pub order_id: String,
    pub provider_id: String,
    pub status: String,
    pub live_ready: bool,
    pub provider_payload: Value,
    pub warnings: Vec<TradingWarning>,
    pub audit_refs: Vec<String>,
    pub decision: TradingDecision,
    pub created_at: String,
}
