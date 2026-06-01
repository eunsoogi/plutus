import { useEffect, useMemo, useState } from "react";

import { useI18n } from "./i18n";
import { HostShell } from "./plutus-app";
import { ProviderWorkbench } from "./provider-settings-composer";
import {
  ModeControl,
  ProviderList,
  ProviderMatrix,
} from "./provider-settings-panels";
import { providerSettingsCopy } from "./provider-settings-copy";
import {
  editProvider,
  fallbackProviders,
  type OrderSide,
  type OrderType,
  type ProviderCommandClient,
  type ProviderId,
  type ProviderMode,
  type TradingDecision,
  type TradingOrderIntent,
  type TradingProviderConfig,
  type DryRunOrderResult,
} from "./provider-settings-types";

type ProviderSettingsPageProps = {
  commandClient?: ProviderCommandClient;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Command failed";
}

function selectProvider(
  providers: readonly TradingProviderConfig[],
  selectedId: ProviderId,
) {
  return (
    providers.find((provider) => provider.providerId === selectedId) ??
    fallbackProviders[0]
  );
}

export function ProviderSettingsPage({
  commandClient,
}: ProviderSettingsPageProps) {
  const { locale } = useI18n();
  const text = providerSettingsCopy[locale];
  const [providers, setProviders] =
    useState<readonly TradingProviderConfig[]>(fallbackProviders);
  const [selectedId, setSelectedId] = useState<ProviderId>("upbit");
  const [mode, setMode] = useState<ProviderMode>("dry_run");
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState("0.01");
  const [limitPrice, setLimitPrice] = useState("65000");
  const [quoteCurrency, setQuoteCurrency] = useState("USDT");
  const [rationale, setRationale] = useState(
    "Dry-run entry after agent review.",
  );
  const [decision, setDecision] = useState<TradingDecision | undefined>();
  const [order, setOrder] = useState<DryRunOrderResult | undefined>();
  const [status, setStatus] = useState(text.idle);

  const provider = useMemo(
    () => selectProvider(providers, selectedId),
    [providers, selectedId],
  );
  const providerForMode = useMemo(
    () => editProvider(provider, mode),
    [mode, provider],
  );

  useEffect(() => {
    let active = true;
    commandClient?.providers
      ?.list()
      .then((nextProviders) => {
        if (active && nextProviders.length > 0) setProviders(nextProviders);
      })
      .catch(() => {
        if (active) setStatus(text.unavailable);
      });
    return () => {
      active = false;
    };
  }, [commandClient, text.unavailable]);

  function buildIntent(): TradingOrderIntent {
    const intent: TradingOrderIntent = {
      providerId: provider.providerId,
      symbol,
      side,
      orderType,
      quantity: Number.parseFloat(quantity),
      quoteCurrency,
      rationale,
      liveRequested: mode === "live_requires_approval",
    };
    const parsedLimit = Number.parseFloat(limitPrice);
    return orderType === "limit" && Number.isFinite(parsedLimit)
      ? { ...intent, limitPrice: parsedLimit }
      : intent;
  }

  function resetPreview() {
    setDecision(undefined);
    setOrder(undefined);
    setStatus(text.idle);
  }

  async function saveProvider() {
    if (!commandClient?.providers?.save) {
      setStatus(text.unavailable);
      return;
    }
    try {
      const saved = await commandClient.providers.save(providerForMode);
      setProviders((current) =>
        current.map((candidate) =>
          candidate.providerId === saved.providerId ? saved : candidate,
        ),
      );
      setStatus(text.saved);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }

  async function previewDecision() {
    if (!commandClient?.trading?.previewDecision) {
      setStatus(text.unavailable);
      return undefined;
    }
    try {
      const nextDecision = await commandClient.trading.previewDecision({
        provider: providerForMode,
        intent: buildIntent(),
      });
      setDecision(nextDecision);
      setStatus(
        nextDecision.finalAction === "live_requires_approval"
          ? text.previewLive
          : text.previewReady,
      );
      return nextDecision;
    } catch (error) {
      setStatus(errorMessage(error));
      return undefined;
    }
  }

  async function submitPreview() {
    if (!commandClient?.trading?.submitDryRunOrder) {
      setStatus(text.unavailable);
      return;
    }
    try {
      const nextDecision = decision ?? (await previewDecision());
      const nextOrder = await commandClient.trading.submitDryRunOrder({
        provider: providerForMode,
        intent: buildIntent(),
        decision: nextDecision,
      });
      setOrder(nextOrder);
      setStatus(
        mode === "live_requires_approval" ? text.previewLive : text.orderReady,
      );
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }

  return (
    <HostShell>
      <header className="page-header provider-header">
        <h1>{text.title}</h1>
        <p>{text.subtitle}</p>
        <div className="pill-row" aria-label={text.safety}>
          <span className="pill">{text.readOnly}</span>
          <span className="pill">{text.dryRunOnly}</span>
          <span className="pill">{text.killSwitch}</span>
        </div>
      </header>

      <section className="provider-layout">
        <ProviderList
          onSelect={(nextProvider) => {
            setSelectedId(nextProvider.providerId);
            resetPreview();
          }}
          providers={providers}
          selectedId={selectedId}
          title={text.connections}
        />
        <article className="panel provider-detail">
          <div className="provider-detail-heading">
            <span>{text.selected}</span>
            <strong>{provider.displayName}</strong>
          </div>
          <ModeControl
            mode={mode}
            onMode={(nextMode) => {
              setMode(nextMode);
              resetPreview();
            }}
            text={text}
          />
          <ProviderMatrix provider={providerForMode} mode={mode} text={text} />
          <div className="provider-actions">
            <button onClick={saveProvider} type="button">
              {text.save}
            </button>
            <button
              data-testid="generate-provider-decision"
              onClick={previewDecision}
              type="button"
            >
              {text.generate}
            </button>
            <button
              data-testid="simulate-provider-preview"
              onClick={submitPreview}
              type="button"
            >
              {text.submit}
            </button>
          </div>
          <p className="preview-line" data-testid="provider-preview-status">
            {status}
          </p>
        </article>
      </section>

      <ProviderWorkbench
        decision={decision}
        limitPrice={limitPrice}
        order={order}
        orderType={orderType}
        quantity={quantity}
        quoteCurrency={quoteCurrency}
        rationale={rationale}
        side={side}
        symbol={symbol}
        text={text}
        setLimitPrice={setLimitPrice}
        setOrderType={setOrderType}
        setQuantity={setQuantity}
        setQuoteCurrency={setQuoteCurrency}
        setRationale={setRationale}
        setSide={setSide}
        setSymbol={setSymbol}
      />
    </HostShell>
  );
}
