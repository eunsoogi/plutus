import { useEffect, useState } from "react";

import { useI18n } from "./i18n";
import { PortfolioRows } from "./portfolio-rows";
import {
  HostShell,
  localizedScenarioText,
  type PlutusCommandClient,
  type PlutusScenario,
} from "./plutus-app";
import type { TradingProviderConfig } from "./provider-settings-types";

export function PortfoliosPage({
  scenario,
  commandClient,
  refreshScenario,
}: {
  scenario: PlutusScenario;
  commandClient?: PlutusCommandClient;
  refreshScenario?: () => Promise<PlutusScenario>;
}) {
  const { t } = useI18n();
  const [currentScenario, setCurrentScenario] = useState(scenario);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [providers, setProviders] =
    useState<readonly TradingProviderConfig[] | null>(null);

  useEffect(() => {
    setCurrentScenario(scenario);
  }, [scenario]);

  useEffect(() => {
    let cancelled = false;
    if (!commandClient?.providers?.list) {
      setProviders(null);
      return;
    }

    setLoadingProviders(true);
    commandClient.providers
      .list()
      .then((providerConfigs) => {
        if (!cancelled) setProviders(providerConfigs);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(commandErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingProviders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [commandClient]);

  const visibleScenario = currentScenario;
  const configuredProvider = providers?.find(isConfiguredProvider);

  async function refreshVisibleScenario() {
    if (!refreshScenario) return null;
    const refreshedScenario = await refreshScenario();
    setCurrentScenario(refreshedScenario);
    return refreshedScenario;
  }

  async function syncFromProvider() {
    setMessage(null);
    if (
      !commandClient?.portfolios?.syncFromProvider ||
      !commandClient.providers?.list
    ) {
      setMessage(t("portfolio.bridgeMissing"));
      return;
    }

    setSyncing(true);
    try {
      const providerConfigs = providers ?? (await commandClient.providers.list());
      setProviders(providerConfigs);
      const provider = providerConfigs.find(isConfiguredProvider);
      if (!provider) {
        setMessage(t("portfolio.syncConfigureFirst"));
        return;
      }
      const result = await commandClient.portfolios.syncFromProvider({
        profileId: scenario.profileId,
        providerId: provider.providerId,
        portfolioName: t("portfolio.syncedName", {
          provider: localizedScenarioText(provider.displayName, t),
        }),
        baseCurrency: providerBaseCurrency(provider),
      });
      await refreshVisibleScenario();
      setMessage(
        t("portfolio.synced", {
          count: result.importedCount,
          provider: localizedScenarioText(provider.displayName, t),
        }),
      );
    } catch (error) {
      setMessage(commandErrorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <HostShell>
      <h1>{t("portfolio.title")}</h1>
      <section className="panel" data-testid="portfolio-provider-sync">
        <h2>{t("portfolio.syncTitle")}</h2>
        {configuredProvider ? (
          <button
            className="primary"
            onClick={syncFromProvider}
            disabled={syncing || loadingProviders}
          >
            {syncing
              ? t("portfolio.syncing")
              : t("portfolio.syncProvider", {
                  provider: localizedScenarioText(
                    configuredProvider.displayName,
                    t,
                  ),
                })}
          </button>
        ) : (
          <a className="primary" href={providerSettingsHref()}>
            {t("portfolio.openProviderSettings")}
          </a>
        )}
        <p>
          {configuredProvider
            ? t("portfolio.syncReady", {
                provider: localizedScenarioText(configuredProvider.displayName, t),
              })
            : t("portfolio.syncConfigureFirst")}
        </p>
      </section>
      {message ? <p data-testid="portfolio-command-status">{message}</p> : null}
      <PortfolioRows scenario={visibleScenario} />
    </HostShell>
  );
}

function isConfiguredProvider(provider: TradingProviderConfig): boolean {
  return (
    provider.mode !== "disabled" &&
    provider.health !== "not_configured" &&
    provider.health !== "blocked" &&
    Boolean(provider.credentialRef?.startsWith("secure://plutus/providers/"))
  );
}

function providerBaseCurrency(provider: TradingProviderConfig): string {
  return provider.region === "KR" ||
    provider.providerId === "kiwoom" ||
    provider.providerId === "upbit"
    ? "KRW"
    : "USD";
}

function providerSettingsHref(): string {
  if (typeof window === "undefined") return "/settings/providers";
  return `/settings/providers${window.location.search}`;
}

function commandErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Command failed";
}
