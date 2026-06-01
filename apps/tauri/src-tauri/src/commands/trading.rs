use super::{
    command_result,
    trading_catalog::CCXT_EXCHANGE_IDS,
    trading_payload::provider_payload,
    trading_types::{
        DryRunOrderResult, TradingAgentView, TradingDecision, TradingDecisionInput,
        TradingOrderIntent, TradingProviderConfig,
    },
};
use crate::storage::{new_id, now};

#[tauri::command]
pub fn list_trading_providers() -> Vec<TradingProviderConfig> {
    default_trading_providers()
}

#[tauri::command]
pub fn save_trading_provider(
    input: TradingProviderConfig,
) -> std::result::Result<TradingProviderConfig, String> {
    command_result(Ok(TradingProviderConfig {
        last_checked_at: now(),
        ..input
    }))
}

#[tauri::command]
pub fn preview_trading_decision(
    input: TradingDecisionInput,
) -> std::result::Result<TradingDecision, String> {
    command_result(Ok(build_decision(input.provider, input.intent)))
}

#[tauri::command]
pub fn submit_dry_run_order(
    input: TradingDecisionInput,
) -> std::result::Result<DryRunOrderResult, String> {
    let decision = build_decision(input.provider.clone(), input.intent.clone());
    let status = match decision.final_action.as_str() {
        "dry_run_allowed" => "accepted",
        "blocked" => "blocked",
        "needs_review" | "live_requires_approval" => "needs_approval",
        _ => "needs_approval",
    };
    command_result(Ok(DryRunOrderResult {
        order_id: format!("dry-run-{}-{}", input.provider.provider_id, new_id()),
        provider_id: input.provider.provider_id.clone(),
        status: status.to_string(),
        live_ready: false,
        provider_payload: provider_payload(&input.provider, &input.intent),
        warnings: decision.warnings.clone(),
        audit_refs: vec![format!("audit:tauri:{}", input.provider.provider_id)],
        decision,
        created_at: now(),
    }))
}

fn default_trading_providers() -> Vec<TradingProviderConfig> {
    let mut providers = Vec::with_capacity(CCXT_EXCHANGE_IDS.len() + 1);
    providers.push(provider_config(
        "kiwoom",
        "Kiwoom Securities",
        "Korean equities",
        "KR",
    ));
    providers.extend(CCXT_EXCHANGE_IDS.iter().map(|exchange_id| {
        provider_config(
            exchange_id,
            &display_name(exchange_id),
            "Spot crypto / derivatives via CCXT",
            "CCXT",
        )
    }));
    providers
}

fn provider_config(
    provider_id: &str,
    display_name: &str,
    market: &str,
    region: &str,
) -> TradingProviderConfig {
    TradingProviderConfig {
        provider_id: provider_id.to_string(),
        display_name: display_name.to_string(),
        market: market.to_string(),
        region: region.to_string(),
        environment: if provider_id == "kiwoom" {
            "mock"
        } else {
            "sandbox"
        }
        .to_string(),
        mode: "dry_run".to_string(),
        permissions: vec![
            "market_data".to_string(),
            "account_read".to_string(),
            "trade_dry_run".to_string(),
        ],
        health: "not_configured".to_string(),
        last_checked_at: now(),
        credential_ref: None,
        warnings: Vec::new(),
    }
}

fn display_name(exchange_id: &str) -> String {
    match exchange_id {
        "binance" => "Binance".to_string(),
        "coinbase" => "Coinbase".to_string(),
        "coinbaseadvanced" => "Coinbase Advanced".to_string(),
        "kiwoom" => "Kiwoom Securities".to_string(),
        "kraken" => "Kraken".to_string(),
        "mexc" => "MEXC".to_string(),
        "okx" => "OKX".to_string(),
        "upbit" => "Upbit".to_string(),
        _ => title_case(exchange_id),
    }
}

fn title_case(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
        None => String::new(),
    }
}

fn build_decision(provider: TradingProviderConfig, intent: TradingOrderIntent) -> TradingDecision {
    let live_requested =
        intent.live_requested.unwrap_or(false) || provider.mode == "live_requires_approval";
    let final_action = if provider.mode == "disabled" {
        "blocked"
    } else if live_requested {
        "live_requires_approval"
    } else if provider.health == "degraded" {
        "needs_review"
    } else {
        "dry_run_allowed"
    };
    let blocking_reasons = if final_action == "live_requires_approval" {
        vec!["Live trading requires explicit user approval.".to_string()]
    } else if final_action == "blocked" {
        vec!["Provider is disabled.".to_string()]
    } else {
        Vec::new()
    };
    TradingDecision {
        decision_id: format!("decision-{}-{}", provider.provider_id, new_id()),
        provider: provider.clone(),
        intent,
        final_action: final_action.to_string(),
        confidence: "medium".to_string(),
        agent_views: agent_views(&provider.provider_id),
        blocking_reasons,
        evidence_refs: vec![format!("provider:{}", provider.provider_id)],
        warnings: provider.warnings.clone(),
        approval_required: final_action == "live_requires_approval",
        created_at: now(),
    }
}

fn agent_views(provider_id: &str) -> Vec<TradingAgentView> {
    vec![
        agent_view(
            "bull_case",
            "support",
            "Dry-run path is available for inspection.",
        ),
        agent_view("bear_case", "caution", "No live venue approval is granted."),
        agent_view("risk_manager", "gate", "Live execution remains blocked."),
        agent_view(
            "execution_specialist",
            "dry_run",
            &format!("Provider {provider_id} payload can be previewed."),
        ),
    ]
}

fn agent_view(role: &str, stance: &str, summary: &str) -> TradingAgentView {
    TradingAgentView {
        role: role.to_string(),
        stance: stance.to_string(),
        summary: summary.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_kiwoom_and_full_ccxt_catalog() {
        let providers = list_trading_providers();

        assert_eq!(providers.len(), 112);
        assert_eq!(providers[0].provider_id, "kiwoom");
        assert!(providers
            .iter()
            .any(|provider| provider.provider_id == "upbit"));
        assert!(providers
            .iter()
            .any(|provider| provider.provider_id == "binance"));
    }

    #[test]
    fn previews_ccxt_dry_run_payload() {
        let provider = provider_config("binance", "Binance", "Spot crypto", "CCXT");
        let intent = TradingOrderIntent {
            provider_id: "binance".to_string(),
            symbol: "BTCUSDT".to_string(),
            side: "buy".to_string(),
            order_type: "market".to_string(),
            quantity: 0.01,
            limit_price: None,
            quote_currency: "USDT".to_string(),
            rationale: Some("Dry-run first.".to_string()),
            live_requested: None,
        };

        let order = submit_dry_run_order(TradingDecisionInput {
            provider,
            intent,
            decision: None,
        })
        .expect("dry-run order should be created");

        assert_eq!(order.status, "accepted");
        assert_eq!(
            order.provider_payload["endpoint"].as_str(),
            Some("ccxt://binance/createOrder")
        );
        assert_eq!(
            order.provider_payload["body"]["symbol"].as_str(),
            Some("BTC/USDT")
        );
    }
}
