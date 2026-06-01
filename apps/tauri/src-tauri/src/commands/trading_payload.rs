use serde_json::{json, Value};

use super::trading_types::{TradingOrderIntent, TradingProviderConfig};
use crate::storage::new_id;

pub(crate) fn provider_payload(
    provider: &TradingProviderConfig,
    intent: &TradingOrderIntent,
) -> Value {
    if provider.provider_id == "kiwoom" {
        return json!({
            "endpoint": "/api/dostk/ordr",
            "method": "POST",
            "dryRun": true,
            "body": {
                "providerId": provider.provider_id,
                "symbol": intent.symbol,
                "side": intent.side,
                "quantity": intent.quantity,
                "orderType": intent.order_type,
                "limitPrice": intent.limit_price,
            },
        });
    }
    json!({
        "endpoint": format!("ccxt://{}/createOrder", provider.provider_id),
        "method": "POST",
        "dryRun": true,
        "body": {
            "exchange": provider.provider_id,
            "symbol": normalized_symbol(&intent.symbol, &intent.quote_currency),
            "type": intent.order_type,
            "side": intent.side,
            "amount": intent.quantity,
            "price": intent.limit_price,
            "params": {
                "clientOrderId": format!("dry-run-{}-{}", provider.provider_id, new_id()),
                "dryRun": true,
            },
        },
    })
}

fn normalized_symbol(symbol: &str, quote_currency: &str) -> String {
    if symbol.contains('/') {
        return symbol.to_string();
    }
    match symbol.strip_suffix(quote_currency) {
        Some(base) if !base.is_empty() => format!("{base}/{quote_currency}"),
        _ => symbol.to_string(),
    }
}
