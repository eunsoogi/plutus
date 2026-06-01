import type { AppLocale } from "./core";
import {
  providerEndpoint,
  providerMarketLabel,
} from "./provider-settings-copy";
import { providerHealthLabel } from "./provider-settings-health";
import type {
  DryRunOrderResult,
  ProviderMode,
  TradingDecision,
  TradingProviderConfig,
} from "./provider-settings-types";

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
      <dl className="provider-matrix" data-testid="provider-matrix">
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
