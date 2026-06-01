import { useMemo, useState } from "react";

import type { AppLocale } from "./core";
import {
  providerDisplayName,
  providerMarketLabel,
} from "./provider-settings-copy";
import {
  providerHealthLabel,
  providerHealthRows,
} from "./provider-settings-health";
import type {
  ProviderId,
  TradingProviderConfig,
} from "./provider-settings-types";

export function ProviderList({
  providers,
  selectedId,
  text,
  title,
  locale,
  onSelect,
}: {
  providers: readonly TradingProviderConfig[];
  selectedId: ProviderId;
  text: Record<string, string>;
  title: string;
  locale: AppLocale;
  onSelect: (provider: TradingProviderConfig) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedProvider =
    providers.find((provider) => provider.providerId === selectedId) ??
    providers[0];
  const visibleProviders = useMemo(
    () => matchingProviders(providers, query, locale),
    [locale, providers, query],
  );
  const selectableProviders =
    visibleProviders.length > 0
      ? visibleProviders
      : selectedProvider
        ? [selectedProvider]
        : [];
  const healthRows = providerHealthRows(providers, text);
  return (
    <article className="panel provider-list" data-testid="provider-list">
      <div className="provider-panel-heading">
        <h2>{title}</h2>
        <small data-testid="provider-catalog-summary">
          {formatCount(text.ccxtCatalog, providers.length - 1)}
        </small>
      </div>
      <dl
        className="provider-health-summary"
        data-testid="provider-health-summary"
      >
        {healthRows.map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <div className="provider-picker">
        <label>
          <span>{text.exchangeSearch}</span>
          <input
            data-testid="provider-search"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={text.exchangeSearchPlaceholder}
            value={query}
          />
        </label>
        <label>
          <span>{text.exchangeSelect}</span>
          <select
            data-testid="provider-select"
            onChange={(event) => {
              const nextProvider = providers.find(
                (provider) => provider.providerId === event.currentTarget.value,
              );
              if (nextProvider) onSelect(nextProvider);
            }}
            value={selectedProvider?.providerId ?? ""}
          >
            {selectableProviders.map((provider) => (
              <option key={provider.providerId} value={provider.providerId}>
                {providerDisplayName(
                  provider.providerId,
                  provider.displayName,
                  locale,
                )}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="provider-card-list">
        {selectableProviders.slice(0, 16).map((provider) => (
          <ProviderCard
            key={provider.providerId}
            locale={locale}
            onSelect={onSelect}
            provider={provider}
            selected={selectedId === provider.providerId}
            text={text}
          />
        ))}
      </div>
    </article>
  );
}

function ProviderCard({
  provider,
  selected,
  text,
  locale,
  onSelect,
}: {
  provider: TradingProviderConfig;
  selected: boolean;
  text: Record<string, string>;
  locale: AppLocale;
  onSelect: (provider: TradingProviderConfig) => void;
}) {
  return (
    <button
      className={`provider-card ${selected ? "selected" : ""}`}
      data-testid={`provider-${provider.providerId}`}
      onClick={() => onSelect(provider)}
      type="button"
    >
      <span>
        <strong>
          {providerDisplayName(provider.providerId, provider.displayName, locale)}
        </strong>
        <small>
          {providerMarketLabel(provider.providerId, provider.market, locale)}
        </small>
      </span>
      <i>{providerHealthLabel(provider.health, text)}</i>
    </button>
  );
}

function matchingProviders(
  providers: readonly TradingProviderConfig[],
  query: string,
  locale: AppLocale,
): readonly TradingProviderConfig[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return providers;
  return providers.filter((provider) => {
    const label = providerDisplayName(
      provider.providerId,
      provider.displayName,
      locale,
    ).toLowerCase();
    return (
      provider.providerId.includes(normalizedQuery) ||
      label.includes(normalizedQuery)
    );
  });
}

function formatCount(template: string, count: number): string {
  return template.replace("{count}", String(count));
}
