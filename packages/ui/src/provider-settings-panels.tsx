import type { AppLocale } from "./core";
import {
  providerDisplayName,
  providerEndpoint,
  providerMarketLabel,
} from "./provider-settings-copy";
import type {
  DryRunOrderResult,
  ProviderId,
  ProviderMode,
  TradingDecision,
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
  const healthRows = providerHealthRows(providers, text);
  return (
    <article className="panel provider-list" data-testid="provider-list">
      <h2>{title}</h2>
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
      {providers.map((provider) => (
        <button
          className={`provider-card ${
            selectedId === provider.providerId ? "selected" : ""
          }`}
          data-testid={`provider-${provider.providerId}`}
          key={provider.providerId}
          onClick={() => onSelect(provider)}
          type="button"
        >
          <span>
            <strong>
              {providerDisplayName(
                provider.providerId,
                provider.displayName,
                locale,
              )}
            </strong>
            <small>
              {providerMarketLabel(provider.providerId, provider.market, locale)}
            </small>
          </span>
          <i>{providerHealthLabel(provider.health, text)}</i>
        </button>
      ))}
    </article>
  );
}

export function ModeControl({
  mode,
  onMode,
  text,
}: {
  mode: ProviderMode;
  onMode: (mode: ProviderMode) => void;
  text: Record<string, string>;
}) {
  return (
    <div className="segmented-control" aria-label={text.mode}>
      <button
        className={mode === "dry_run" ? "active" : ""}
        data-testid="provider-mode-dry-run"
        onClick={() => onMode("dry_run")}
        type="button"
      >
        {text.dryRun}
      </button>
      <button
        className={mode === "live_requires_approval" ? "active danger" : ""}
        data-testid="provider-mode-live"
        onClick={() => onMode("live_requires_approval")}
        type="button"
      >
        {text.liveApproval}
      </button>
    </div>
  );
}

export function ProviderMatrix({
  provider,
  mode,
  text,
  locale,
}: {
  provider: TradingProviderConfig;
  mode: ProviderMode;
  text: Record<string, string>;
  locale: AppLocale;
}) {
  const rows = [
    [
      text.market,
      providerMarketLabel(provider.providerId, provider.market, locale),
    ],
    [text.region, provider.region],
    [text.endpoint, providerEndpoint(provider.providerId)],
    [text.credentials, provider.credentialRef ?? text.noCredential],
    [
      text.status,
      mode === "live_requires_approval"
        ? text.liveBlocked
        : provider.health === "connected"
          ? text.dryRunReady
          : providerHealthLabel(provider.health, text),
    ],
    [text.permissions, provider.permissions.join(", ")],
  ];
  return (
    <>
      <dl className="provider-matrix">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="permission-chip-row" data-testid="provider-permissions">
        {provider.permissions.map((permission) => (
          <span className="permission-chip" key={permission}>
            {permission}
          </span>
        ))}
      </div>
    </>
  );
}

function providerHealthLabel(
  health: TradingProviderConfig["health"],
  text: Record<string, string>,
): string {
  switch (health) {
    case "connected":
      return text.connected;
    case "degraded":
      return text.degraded;
    case "not_configured":
      return text.notConfigured;
    case "blocked":
      return text.blocked;
    default:
      return assertNever(health);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported provider health: ${String(value)}`);
}

export function DecisionPanel({
  decision,
  text,
  title,
}: {
  decision: TradingDecision | undefined;
  text: Record<string, string>;
  title: string;
}) {
  return (
    <section data-testid="trading-decision-panel">
      <h2>{title}</h2>
      <div className="decision-lanes">
        {(decision?.agentViews ?? []).map((view) => (
          <div className="decision-lane" key={view.role}>
            <strong>{view.role.replaceAll("_", " ")}</strong>
            <span>{view.summary}</span>
          </div>
        ))}
      </div>
      {decision ? (
        <>
          <p className="preview-line">
            {decision.finalAction} / {decision.confidence}
          </p>
          <div className="decision-meta">
            <span>
              <strong>{text.blockingReasons}</strong>
              {decision.blockingReasons.join(", ") || text.noBlockingReasons}
            </span>
            <span>
              <strong>{text.evidence}</strong>
              {decision.evidenceRefs.join(", ")}
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}

function providerHealthRows(
  providers: readonly TradingProviderConfig[],
  text: Record<string, string>,
) {
  const counts = providers.reduce(
    (summary, provider) => ({
      ...summary,
      [provider.health]: summary[provider.health] + 1,
    }),
    {
      connected: 0,
      degraded: 0,
      not_configured: 0,
      blocked: 0,
    },
  );
  return [
    [text.connected, counts.connected],
    [text.degraded, counts.degraded],
    [text.notConfigured, counts.not_configured],
    [text.blocked, counts.blocked],
  ] as const;
}

export function PayloadPanel({
  order,
  title,
}: {
  order: DryRunOrderResult | undefined;
  title: string;
}) {
  return order ? (
    <section>
      <h2>{title}</h2>
      <pre className="payload-preview" data-testid="provider-payload">
        {JSON.stringify(order.providerPayload, null, 2)}
      </pre>
    </section>
  ) : null;
}
