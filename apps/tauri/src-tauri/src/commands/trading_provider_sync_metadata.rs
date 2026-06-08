use serde_json::{json, Value};

use super::trading_types::TradingProviderConfig;

pub(super) fn normalized_portfolio_name(
    portfolio_name: Option<&str>,
    provider: &TradingProviderConfig,
) -> String {
    portfolio_name
        .and_then(non_empty_trimmed)
        .map(ToString::to_string)
        .unwrap_or_else(|| format!("{} Synced Holdings", provider.display_name))
}

pub(super) fn risk_profile_matches_provider(raw_risk_profile: &str, provider_id: &str) -> bool {
    serde_json::from_str::<Value>(raw_risk_profile)
        .ok()
        .is_some_and(|risk_profile| {
            risk_profile
                .get("providerSync")
                .and_then(|provider_sync| provider_sync.get("providerId"))
                .and_then(Value::as_str)
                .is_some_and(|candidate| candidate == provider_id)
        })
}

pub(super) fn tag_provider_sync(mut risk_profile: Value, provider_id: &str) -> Value {
    if !risk_profile.is_object() {
        risk_profile = json!({});
    }
    if let Some(object) = risk_profile.as_object_mut() {
        object.insert(
            "providerSync".to_string(),
            json!({ "providerId": provider_id }),
        );
    }
    risk_profile
}

fn non_empty_trimmed(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}
