import { providerEndpoint } from "./provider-settings-copy";
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
  title,
  onSelect,
}: {
  providers: readonly TradingProviderConfig[];
  selectedId: ProviderId;
  title: string;
  onSelect: (provider: TradingProviderConfig) => void;
}) {
  return (
    <article className="panel provider-list" data-testid="provider-list">
      <h2>{title}</h2>
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
            <strong>{provider.displayName}</strong>
            <small>{provider.market}</small>
          </span>
          <i>{provider.health.replace("_", " ")}</i>
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
}: {
  provider: TradingProviderConfig;
  mode: ProviderMode;
  text: Record<string, string>;
}) {
  const rows = [
    [text.market, provider.market],
    [text.region, provider.region],
    [text.endpoint, providerEndpoint(provider.providerId)],
    [text.credentials, provider.credentialRef ?? text.noCredential],
    [
      text.status,
      mode === "live_requires_approval" ? text.liveBlocked : text.dryRunReady,
    ],
    [text.permissions, provider.permissions.join(", ")],
  ];
  return (
    <dl className="provider-matrix">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DecisionPanel({
  decision,
  title,
}: {
  decision: TradingDecision | undefined;
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
        <p className="preview-line">
          {decision.finalAction} / {decision.confidence}
        </p>
      ) : null}
    </section>
  );
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
