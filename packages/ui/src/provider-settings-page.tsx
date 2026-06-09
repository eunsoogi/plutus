import { useEffect, useMemo, useState } from "react";

import { useI18n } from "./i18n";
import { HostShell } from "./plutus-app";
import {
  emptyCredentialDraft,
  errorMessage,
  providerCredentialRef,
  selectProvider,
  updateCredentialDraft,
} from "./provider-settings-credentials";
import { ProviderDetail } from "./provider-settings-detail";
import { ProviderWorkbench } from "./provider-settings-composer";
import { ProviderList } from "./provider-settings-provider-list";
import { providerSettingsCopy } from "./provider-settings-copy";
import { ProviderSettingsHeader } from "./provider-settings-header";
import { createTradingOrderIntent } from "./provider-settings-order";
import {
  editProvider,
  fallbackProviders,
  type DryRunOrderResult,
  type OrderSide,
  type OrderType,
  type ProviderCommandClient,
  type ProviderId,
  type ProviderMode,
  type TradingDecision,
  type TradingOrderIntent,
  type TradingProviderConfig,
} from "./provider-settings-types";

export function ProviderSettingsPage({
  commandClient,
}: {
  commandClient?: ProviderCommandClient;
}) {
  const { locale } = useI18n();
  const text = providerSettingsCopy[locale];
  const [providers, setProviders] =
    useState<readonly TradingProviderConfig[]>(fallbackProviders);
  const [selectedId, setSelectedId] = useState<ProviderId>("kiwoom");
  const [mode, setMode] = useState<ProviderMode>("dry_run");
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState("0.01");
  const [limitPrice, setLimitPrice] = useState("65000");
  const [quoteCurrency, setQuoteCurrency] = useState("USDT");
  const [credentialRef, setCredentialRef] = useState("");
  const [credentialDraft, setCredentialDraft] = useState(emptyCredentialDraft);
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
    () =>
      editProvider(provider, {
        credentialRef: providerCredentialRef(
          provider.providerId,
          credentialDraft,
          credentialRef,
        ),
        mode,
      }),
    [credentialDraft, credentialRef, mode, provider],
  );

  useEffect(() => {
    setCredentialRef(provider.credentialRef ?? "");
    setCredentialDraft(emptyCredentialDraft);
  }, [provider.credentialRef, provider.providerId]);

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
    return createTradingOrderIntent({
      providerId: provider.providerId,
      symbol,
      side,
      orderType,
      quantity,
      limitPrice,
      quoteCurrency,
      rationale,
      mode,
    });
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
    const nextCredentialRef = providerCredentialRef(
      provider.providerId,
      credentialDraft,
      credentialRef,
    );
    if (
      nextCredentialRef &&
      !nextCredentialRef.startsWith("secure://plutus/")
    ) {
      setStatus(text.credentialInvalid);
      return;
    }
    try {
      const saved = await commandClient.providers.save(providerForMode);
      setCredentialDraft(emptyCredentialDraft);
      setCredentialRef(saved.credentialRef ?? "");
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
      <div className="provider-page">
        <ProviderSettingsHeader text={text} />

        <section className="provider-layout">
          <ProviderList
            onSelect={(nextProvider) => {
              setSelectedId(nextProvider.providerId);
              resetPreview();
            }}
            providers={providers}
            selectedId={selectedId}
            text={text}
            title={text.connections}
            locale={locale}
          />
          <ProviderDetail
            credentialDraft={credentialDraft}
            credentialStorageRef={
              providerForMode.credentialRef ?? text.noCredential
            }
            locale={locale}
            mode={mode}
            onCredentialDraft={(field, value) => {
              setCredentialDraft((draft) =>
                updateCredentialDraft(draft, field, value),
              );
              resetPreview();
            }}
            onGenerate={previewDecision}
            onMode={(nextMode) => {
              setMode(nextMode);
              resetPreview();
            }}
            onSave={saveProvider}
            onSubmit={submitPreview}
            provider={provider}
            providerForMode={providerForMode}
            status={status}
            text={text}
          />
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
      </div>
    </HostShell>
  );
}
