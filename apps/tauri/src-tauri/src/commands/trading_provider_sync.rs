use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

use super::{
    provider_holdings::{
        asset_type_for_symbol, exchange_for_symbol, normalize_currency, normalize_holding,
        preview_synced_holdings_for_provider, provider_base_currency, NormalizedHolding,
    },
    trading_provider_config::provider_is_configured,
    trading_provider_sync_metadata::{
        normalized_portfolio_name, risk_profile_matches_provider, tag_provider_sync,
    },
    trading_types::{
        ProviderPortfolioSyncInput, ProviderPortfolioSyncResult, TradingProviderConfig,
    },
    PlutusCommands,
};
use crate::storage::{
    new_id, now, NewPosition, Portfolio, PortfolioRepository, MVP_MANUAL_ACCOUNT_ID, MVP_PROFILE_ID,
};

impl<'a> PlutusCommands<'a> {
    pub fn sync_portfolio_from_provider(
        &self,
        input: ProviderPortfolioSyncInput,
    ) -> Result<ProviderPortfolioSyncResult> {
        self.db.ensure_default_profile()?;
        let profile_id = input
            .profile_id
            .clone()
            .unwrap_or_else(|| MVP_PROFILE_ID.to_string());
        let provider = self
            .list_trading_providers()?
            .into_iter()
            .find(|candidate| candidate.provider_id == input.provider_id)
            .with_context(|| {
                format!(
                    "Configure provider {} before syncing holdings.",
                    input.provider_id
                )
            })?;
        if !provider_is_configured(&provider) {
            bail!(
                "Configure provider {} before syncing holdings.",
                provider.provider_id
            );
        }

        let base_currency = input
            .base_currency
            .as_deref()
            .map(normalize_currency)
            .transpose()?
            .unwrap_or_else(|| provider_base_currency(&provider));
        let holdings = input
            .holdings
            .unwrap_or_else(|| preview_synced_holdings_for_provider(&provider, &base_currency))
            .into_iter()
            .map(normalize_holding)
            .collect::<Result<Vec<_>>>()?;
        let portfolio = self.upsert_synced_portfolio(
            &profile_id,
            input.portfolio_id.as_deref(),
            input.portfolio_name.as_deref(),
            &base_currency,
            &provider,
        )?;
        self.db.conn.execute(
            "DELETE FROM positions WHERE portfolio_id = ?1",
            params![portfolio.id],
        )?;

        let mut position_symbols = Vec::with_capacity(holdings.len());
        for holding in holdings {
            let instrument_id = self.resolve_or_create_synced_instrument(&holding)?;
            self.db.add_position(NewPosition {
                portfolio_id: portfolio.id.clone(),
                account_id: MVP_MANUAL_ACCOUNT_ID.to_string(),
                instrument_id,
                quantity: holding.quantity,
                average_cost: holding.average_cost,
                cost_currency: holding.cost_currency,
                thesis: holding.thesis,
            })?;
            position_symbols.push(holding.symbol);
        }
        self.export_local_tool_portfolio_state(&profile_id)?;

        Ok(ProviderPortfolioSyncResult {
            imported_count: position_symbols.len(),
            portfolio_id: portfolio.id,
            provider_id: provider.provider_id,
            skipped_count: 0,
            position_symbols,
        })
    }

    fn upsert_synced_portfolio(
        &self,
        profile_id: &str,
        portfolio_id: Option<&str>,
        portfolio_name: Option<&str>,
        base_currency: &str,
        provider: &TradingProviderConfig,
    ) -> Result<Portfolio> {
        let name = normalized_portfolio_name(portfolio_name, provider);
        if let Some(portfolio_id) = portfolio_id {
            let owner_profile_id = self
                .profile_id_for_portfolio(portfolio_id)?
                .context("portfolio not found")?;
            if owner_profile_id != profile_id {
                bail!("portfolio outside active profile");
            }
            return self.update_synced_portfolio(
                portfolio_id,
                &name,
                base_currency,
                &provider.provider_id,
            );
        }
        if let Some(existing_portfolio_id) =
            self.synced_portfolio_id_for_provider(profile_id, &provider.provider_id)?
        {
            return self.update_synced_portfolio(
                &existing_portfolio_id,
                &name,
                base_currency,
                &provider.provider_id,
            );
        }
        if let Some(existing_portfolio_id) = self.synced_portfolio_id_for_name(profile_id, &name)? {
            return self.update_synced_portfolio(
                &existing_portfolio_id,
                &name,
                base_currency,
                &provider.provider_id,
            );
        }
        let portfolio = self.db.create_portfolio(profile_id, &name, base_currency)?;
        self.update_synced_portfolio(&portfolio.id, &name, base_currency, &provider.provider_id)
    }

    fn synced_portfolio_id_for_provider(
        &self,
        profile_id: &str,
        provider_id: &str,
    ) -> Result<Option<String>> {
        let mut stmt = self.db.conn.prepare(
            "SELECT id, risk_profile FROM portfolios WHERE profile_id = ?1 ORDER BY updated_at DESC, created_at DESC",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (portfolio_id, risk_profile) = row?;
            if risk_profile_matches_provider(&risk_profile, provider_id) {
                return Ok(Some(portfolio_id));
            }
        }
        Ok(None)
    }

    fn synced_portfolio_id_for_name(&self, profile_id: &str, name: &str) -> Result<Option<String>> {
        self.db
            .conn
            .query_row(
                "SELECT id FROM portfolios WHERE profile_id = ?1 AND name = ?2 ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                params![profile_id, name],
                |row| row.get(0),
            )
            .optional()
            .map_err(Into::into)
    }

    fn update_synced_portfolio(
        &self,
        portfolio_id: &str,
        name: &str,
        base_currency: &str,
        provider_id: &str,
    ) -> Result<Portfolio> {
        let risk_profile = self.provider_synced_risk_profile(portfolio_id, provider_id)?;
        self.db.conn.execute(
            "UPDATE portfolios SET name = ?1, base_currency = ?2, risk_profile = ?3, updated_at = ?4 WHERE id = ?5",
            params![name, base_currency, risk_profile.to_string(), now(), portfolio_id],
        )?;
        self.load_portfolio(portfolio_id)
    }

    fn provider_synced_risk_profile(&self, portfolio_id: &str, provider_id: &str) -> Result<Value> {
        let raw_risk_profile = self.db.conn.query_row(
            "SELECT risk_profile FROM portfolios WHERE id = ?1",
            params![portfolio_id],
            |row| row.get::<_, String>(0),
        )?;
        let risk_profile = match serde_json::from_str(&raw_risk_profile) {
            Ok(value) => value,
            Err(_) => json!({}),
        };
        Ok(tag_provider_sync(risk_profile, provider_id))
    }

    fn load_portfolio(&self, portfolio_id: &str) -> Result<Portfolio> {
        self.db
            .conn
            .query_row(
                "SELECT id, profile_id, name, base_currency, benchmark_id, risk_profile, created_at, updated_at FROM portfolios WHERE id = ?1",
                params![portfolio_id],
                |row| {
                    let risk_profile: String = row.get(5)?;
                    Ok(Portfolio {
                        id: row.get(0)?,
                        profile_id: row.get(1)?,
                        name: row.get(2)?,
                        base_currency: row.get(3)?,
                        benchmark_id: row.get(4)?,
                        risk_profile: serde_json::from_str(&risk_profile).unwrap_or_else(|_| json!({})),
                        created_at: row.get(6)?,
                        updated_at: row.get(7)?,
                    })
                },
            )
            .optional()?
            .context("portfolio not found")
    }

    fn resolve_or_create_synced_instrument(&self, holding: &NormalizedHolding) -> Result<String> {
        if let Some(instrument_id) = self
            .db
            .conn
            .query_row(
                "SELECT id FROM instruments WHERE display_symbol = ?1 OR canonical_symbol = ?1 LIMIT 1",
                params![holding.symbol],
                |row| row.get(0),
            )
            .optional()?
        {
            return Ok(instrument_id);
        }

        let timestamp = now();
        let instrument_id = new_id();
        self.db.conn.execute(
            "INSERT INTO instruments(id, asset_type, canonical_symbol, display_symbol, name, currency, exchange, provider_refs, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, 'active', ?8, ?8)",
            params![
                instrument_id,
                asset_type_for_symbol(&holding.symbol),
                holding.symbol,
                holding.name,
                holding.cost_currency,
                exchange_for_symbol(&holding.symbol),
                json!({"provider_sync": holding.symbol}).to_string(),
                timestamp
            ],
        )?;
        Ok(instrument_id)
    }
}
