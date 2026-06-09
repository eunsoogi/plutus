import { formatCurrency } from "./core";
import { useI18n } from "./i18n";
import { OrchestratorOffice } from "./orchestrator-office";
import { AgentActivityPanel } from "./plutus-agent-activity";
import {
  localizedPortfolioHeading,
  localizedScenarioText,
  preserveRuntimeSearch,
} from "./plutus-command";
import { HostShell } from "./plutus-shell";
import type { PlutusScenario } from "./plutus-types";
import { WatchlistPanel } from "./plutus-watchlists";
import { RunStageList } from "./plutus-run-detail";

export function RiskWarning() {
  const { t } = useI18n();
  return (
    <section className="risk-warning" data-testid="risk-warning">
      <strong>{t("risk.title")}</strong>
      <span>{t("risk.body")}</span>
    </section>
  );
}

export function RiskChart() {
  const { t } = useI18n();
  return (
    <div
      className="chart"
      data-testid="artifact-chart"
      data-rendered="true"
      aria-label={t("chart.exposure")}
    >
      <svg
        data-testid="risk-chart"
        viewBox="0 0 320 120"
        role="img"
        aria-label={t("chart.exposureLine")}
      >
        <rect x="0" y="0" width="320" height="120" fill="#0c1219" />
        <path
          d="M0 90H320M0 60H320M0 30H320M40 0V120M120 0V120M200 0V120M280 0V120"
          stroke="#263445"
          strokeWidth="1"
        />
        <path
          d="M10 90L70 80L130 55L190 70L250 35L310 28L310 120L10 120Z"
          fill="#56b6c7"
          fillOpacity="0.12"
        />
        <polyline
          points="10,90 70,80 130,55 190,70 250,35 310,28"
          fill="none"
          stroke="#56b6c7"
          strokeWidth="4"
        />
        <polyline
          points="10,100 70,92 130,82 190,75 250,68 310,60"
          fill="none"
          stroke="#ef6b62"
          strokeWidth="4"
        />
      </svg>
      <span style={{ height: "76%" }}>BTC</span>
      <span style={{ height: "62%" }}>NVDA</span>
      <span style={{ height: "38%" }}>{t("chart.cash")}</span>
    </div>
  );
}

export function ArtifactList({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  return (
    <section className="artifact-list" data-testid="artifact-list">
      <h2>{t("artifact.list")}</h2>
      {scenario.run.artifacts.map((artifact) => (
        <a
          key={artifact.id}
          href={`/runs/${scenario.run.id}/artifacts/${artifact.id}${preserveRuntimeSearch()}`}
          aria-label={t("artifact.open", {
            name: localizedScenarioText(artifact.name, t),
          })}
        >
          {localizedScenarioText(artifact.name, t)}
        </a>
      ))}
    </section>
  );
}

export function HostDashboard({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  const symbols = scenario.portfolio.positions.map(
    (position) => position.symbol,
  );
  const hasRunActivity = Boolean(
    scenario.run.id ||
    scenario.run.category ||
    scenario.run.finalCard ||
    scenario.run.artifacts.length,
  );
  const hasLocalData = Boolean(
    scenario.portfolio.id ||
    scenario.watchlist.id ||
    scenario.run.id ||
    scenario.run.artifacts.length ||
    scenario.memory.id ||
    scenario.memory.summary ||
    scenario.wiki.id ||
    (scenario.remoteDevice.name &&
      scenario.remoteDevice.name !== "No paired device"),
  );
  const dashboardOfficeRun = hasRunActivity
    ? scenario.run
    : {
        ...scenario.run,
        id: "dashboard-office-planning",
        status: "queued",
        title: scenario.run.title || t("runs.noRunsYet"),
      };
  return (
    <HostShell>
      <header className="page-header">
        <p className="eyebrow">{t("dashboard.eyebrow")}</p>
        <h1>{t("dashboard.title")}</h1>
        <h2>{t("dashboard.host")}</h2>
        <div className="pill-row" aria-label={t("aria.workspaceStatus")}>
          <span className="pill">{t("dashboard.workflow")}</span>
          <span className="pill">
            {hasLocalData
              ? t("dashboard.dataLoaded")
              : t("dashboard.dataStatus")}
          </span>
          <span className="pill">
            {symbols.length ? symbols.join(" / ") : t("remote.noPositions")}
          </span>
        </div>
      </header>
      <section className="dashboard-grid">
        <div className="dashboard-stack">
          <PortfolioSummary scenario={scenario} />
          <WatchlistPanel
            scenario={scenario}
            title={localizedScenarioText(scenario.watchlist.name, t)}
          />
        </div>
        <OrchestratorOffice run={dashboardOfficeRun} />
        <article className="panel dashboard-span">
          <h2>{t("artifact.list")}</h2>
          <p data-testid="artifact-title">
            {localizedScenarioText(scenario.run.artifacts[0]?.name, t) ||
              t("artifact.none")}
          </p>
          {scenario.run.artifacts.length > 0 ? (
            <RiskChart />
          ) : (
            <div className="empty-canvas" aria-label={t("artifact.none")}>
              <span />
              <strong>{t("runs.noRunsYet")}</strong>
              <p>{t("settings.preview")}</p>
            </div>
          )}
        </article>
        <div className="dashboard-stack">
          {scenario.run.category ? (
            <article className="panel">
              <h2>{t("dashboard.currentGuardrail")}</h2>
              <RiskWarning />
            </article>
          ) : null}
          {hasRunActivity ? <AgentActivityPanel scenario={scenario} /> : null}
        </div>
        <article className="panel run-panel dashboard-span">
          <h2>{t("dashboard.runProgress")}</h2>
          <RunStageList />
        </article>
      </section>
    </HostShell>
  );
}

export function PortfolioSummary({ scenario }: { scenario: PlutusScenario }) {
  const { locale, t } = useI18n();
  const portfolioName = localizedScenarioText(scenario.portfolio.name, t);
  const portfolioHeading = scenario.portfolio.id
    ? localizedPortfolioHeading(scenario.portfolio.name, t)
    : portfolioName;
  return (
    <article className="panel" data-testid="portfolio-core">
      <h2>{portfolioHeading}</h2>
      <p data-testid="portfolio-name">{portfolioName}</p>
      <p className="metric">
        {formatCurrency(scenario.portfolio.value, "USD", locale)}
      </p>
      <div className="desk-table position-list">
        <div className="desk-row header">
          <span>{t("table.symbol")}</span>
          <span>{t("table.quantity")}</span>
          <span>{t("table.value")}</span>
          <span>{t("table.thesis")}</span>
        </div>
        {scenario.portfolio.positions.length ? (
          scenario.portfolio.positions.map((position) => (
            <div className="desk-row" key={position.symbol}>
              <strong>{position.symbol}</strong>
              <strong>{position.allocation}</strong>
              <span>{formatCurrency(position.value, "USD", locale)}</span>
              <span>{position.thesis || t("common.notAvailable")}</span>
            </div>
          ))
        ) : (
          <div className="desk-row empty-row">
            <strong>{t("portfolio.empty")}</strong>
            <span>-</span>
            <span>-</span>
            <span>{t("runtime.body")}</span>
          </div>
        )}
      </div>
    </article>
  );
}
