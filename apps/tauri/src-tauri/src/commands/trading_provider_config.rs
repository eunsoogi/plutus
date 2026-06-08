use anyhow::Result;
use rusqlite::params;

use super::{
    trading::default_trading_providers, trading_types::TradingProviderConfig, PlutusCommands,
};
use crate::{security::redact_secrets, storage::now};

pub(crate) const SECURE_CREDENTIAL_PREFIX: &str = "secure://plutus/";

impl<'a> PlutusCommands<'a> {
    pub fn list_trading_providers(&self) -> Result<Vec<TradingProviderConfig>> {
        let persisted_providers = self.load_persisted_trading_providers()?;
        Ok(merge_trading_providers(
            default_trading_providers(),
            persisted_providers,
        ))
    }

    pub fn save_trading_provider(
        &self,
        input: TradingProviderConfig,
    ) -> Result<TradingProviderConfig> {
        let provider = sanitize_trading_provider(input);
        let timestamp = now();
        let config_json = serde_json::to_string(&provider)?;
        self.db.conn.execute(
            "INSERT INTO trading_provider_configs(provider_id, config_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(provider_id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at",
            params![provider.provider_id, config_json, timestamp],
        )?;
        Ok(provider)
    }

    fn load_persisted_trading_providers(&self) -> Result<Vec<TradingProviderConfig>> {
        let mut stmt = self
            .db
            .conn
            .prepare("SELECT config_json FROM trading_provider_configs ORDER BY provider_id")?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows.into_iter()
            .map(|row| serde_json::from_str::<TradingProviderConfig>(&row).map_err(Into::into))
            .collect()
    }
}

pub(crate) fn provider_is_configured(provider: &TradingProviderConfig) -> bool {
    provider.mode != "disabled"
        && provider.health != "not_configured"
        && provider.health != "blocked"
        && provider
            .credential_ref
            .as_deref()
            .is_some_and(|credential_ref| credential_ref.starts_with(SECURE_CREDENTIAL_PREFIX))
}

fn sanitize_trading_provider(mut provider: TradingProviderConfig) -> TradingProviderConfig {
    provider.last_checked_at = now();
    provider.warnings = provider
        .warnings
        .into_iter()
        .map(|mut warning| {
            warning.message = redact_secrets(&warning.message);
            warning
        })
        .collect();
    let credential_is_secure = provider
        .credential_ref
        .as_deref()
        .is_some_and(|credential_ref| credential_ref.starts_with(SECURE_CREDENTIAL_PREFIX));
    if provider.credential_ref.is_some() && !credential_is_secure {
        provider.credential_ref = None;
    }
    if provider.credential_ref.is_none() && provider.health == "connected" {
        provider.health = "not_configured".to_string();
    }
    provider
}

fn merge_trading_providers(
    default_providers: Vec<TradingProviderConfig>,
    persisted_providers: Vec<TradingProviderConfig>,
) -> Vec<TradingProviderConfig> {
    let mut providers = default_providers;
    for persisted_provider in persisted_providers {
        match providers
            .iter()
            .position(|provider| provider.provider_id == persisted_provider.provider_id)
        {
            Some(index) => providers[index] = persisted_provider,
            None => providers.push(persisted_provider),
        }
    }
    providers
}
