use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePortfolioInput {
    pub profile_id: String,
    pub name: String,
    pub base_currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartResearchRunInput {
    pub profile_id: String,
    pub portfolio_id: Option<String>,
    pub user_request: String,
    pub selected_team: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionInput {
    pub profile_id: String,
    pub portfolio_id: String,
    pub account_id: Option<String>,
    pub symbol: String,
    pub quantity: f64,
    pub average_cost: f64,
    pub cost_currency: Option<String>,
    pub thesis: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePositionInput {
    pub profile_id: String,
    pub position_id: String,
    pub quantity: Option<f64>,
    pub thesis: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWatchlistInput {
    pub profile_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchlistItemInput {
    pub profile_id: String,
    pub watchlist_id: String,
    pub symbol: String,
    pub trigger_note: Option<String>,
    pub target_zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWatchlistItemInput {
    pub profile_id: String,
    pub item_id: String,
    pub trigger_note: Option<String>,
    pub target_zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairRemoteDeviceInput {
    pub profile_id: String,
    pub device_name: String,
    pub device_platform: String,
    pub public_key: String,
    pub allowed_groups: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareRemoteUnlockInput {
    pub command_id: String,
    pub command_type: String,
    pub payload: Value,
}
