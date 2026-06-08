use anyhow::{bail, Context, Result};

use super::trading_types::{ProviderSyncedHolding, TradingProviderConfig};

#[derive(Debug, Clone)]
pub(crate) struct NormalizedHolding {
    pub symbol: String,
    pub name: String,
    pub quantity: f64,
    pub average_cost: f64,
    pub cost_currency: String,
    pub thesis: String,
}

pub(crate) fn provider_base_currency(provider: &TradingProviderConfig) -> String {
    if provider.region == "KR"
        || provider.provider_id == "kiwoom"
        || provider.provider_id == "upbit"
    {
        "KRW".to_string()
    } else {
        "USD".to_string()
    }
}

pub(crate) fn preview_synced_holdings_for_provider(
    provider: &TradingProviderConfig,
    base_currency: &str,
) -> Vec<ProviderSyncedHolding> {
    match provider.provider_id.as_str() {
        "upbit" => vec![
            ProviderSyncedHolding {
                symbol: "BTC-KRW".to_string(),
                name: Some("Bitcoin".to_string()),
                quantity: 0.42,
                average_cost: 91_000_000.0,
                cost_currency: "KRW".to_string(),
                thesis: Some(format!(
                    "Imported from {} account balance.",
                    provider.display_name
                )),
            },
            ProviderSyncedHolding {
                symbol: "ETH-KRW".to_string(),
                name: Some("Ethereum".to_string()),
                quantity: 2.5,
                average_cost: 4_800_000.0,
                cost_currency: "KRW".to_string(),
                thesis: None,
            },
        ],
        "kiwoom" => vec![
            ProviderSyncedHolding {
                symbol: "005930.KS".to_string(),
                name: Some("Samsung Electronics".to_string()),
                quantity: 10.0,
                average_cost: 70_000.0,
                cost_currency: base_currency.to_string(),
                thesis: Some(format!(
                    "Imported from {} account balance.",
                    provider.display_name
                )),
            },
            ProviderSyncedHolding {
                symbol: "035420.KS".to_string(),
                name: Some("NAVER".to_string()),
                quantity: 3.0,
                average_cost: 185_000.0,
                cost_currency: base_currency.to_string(),
                thesis: None,
            },
        ],
        _ => vec![ProviderSyncedHolding {
            symbol: format!("{}-POSITION", provider.provider_id),
            name: Some(format!("{} Position", provider.display_name)),
            quantity: 1.0,
            average_cost: 100.0,
            cost_currency: base_currency.to_string(),
            thesis: Some(format!(
                "Imported from {} account balance.",
                provider.display_name
            )),
        }],
    }
}

pub(crate) fn normalize_holding(holding: ProviderSyncedHolding) -> Result<NormalizedHolding> {
    let symbol = normalize_symbol(&holding.symbol)?;
    if !holding.quantity.is_finite() || holding.quantity <= 0.0 {
        bail!("Synced holding quantity must be greater than 0.");
    }
    if !holding.average_cost.is_finite() || holding.average_cost < 0.0 {
        bail!("Synced holding average cost must be 0 or greater.");
    }
    let cost_currency = normalize_currency(&holding.cost_currency)?;
    let name = holding
        .name
        .as_deref()
        .and_then(non_empty_trimmed)
        .unwrap_or(&symbol)
        .to_string();
    Ok(NormalizedHolding {
        symbol,
        name,
        quantity: holding.quantity,
        average_cost: holding.average_cost,
        cost_currency,
        thesis: holding.thesis.unwrap_or_default(),
    })
}

pub(crate) fn normalize_currency(currency: &str) -> Result<String> {
    non_empty_trimmed(currency)
        .map(|value| value.to_ascii_uppercase())
        .context("Synced holding cost currency is required.")
}

pub(crate) fn asset_type_for_symbol(symbol: &str) -> &'static str {
    if symbol.ends_with(".KS") {
        "stock"
    } else if symbol.contains('-') {
        "crypto"
    } else {
        "asset"
    }
}

pub(crate) fn exchange_for_symbol(symbol: &str) -> &'static str {
    if symbol.ends_with(".KS") {
        "KRX"
    } else if symbol.ends_with("-KRW") || symbol.ends_with("-USD") {
        "CRYPTO"
    } else {
        "SYNC"
    }
}

fn normalize_symbol(symbol: &str) -> Result<String> {
    non_empty_trimmed(symbol)
        .map(|value| value.to_ascii_uppercase())
        .context("Synced holding symbol is required.")
}

fn non_empty_trimmed(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}
