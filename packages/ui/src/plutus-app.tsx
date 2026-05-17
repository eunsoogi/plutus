import { useState, type ReactNode } from "react";
import {
  formatCurrency,
  remoteStateLabel,
  type RemoteVisualState,
} from "./core";

export type RouteKind = "host" | "remote";

export type PlutusScenario = {
  portfolio: {
    id: string;
    name: string;
    value: number;
    positions: {
      symbol: string;
      name: string;
      value: number;
      allocation: string;
      thesis: string;
    }[];
  };
  watchlist: {
    id: string;
    name: string;
    items: string[];
  };
  instrument: {
    id: string;
    symbol: string;
    name: string;
    summary: string;
  };
  run: {
    id: string;
    title: string;
    status: string;
    category: string;
    artifacts: {
      id: string;
      name: string;
      type: string;
    }[];
  };
  memory: {
    id: string;
    summary: string;
    activity: string;
  };
  wiki: {
    id: string;
    title: string;
    revision: string;
    sourceRef: string;
  };
  remoteDevice: {
    name: string;
    pairingCode: string;
  };
};

export type HostShellProps = {
  children: ReactNode;
};

export function HostShell({ children }: HostShellProps) {
  return (
    <main
      className="app-shell"
      data-testid="route-surface"
      data-route-kind="host"
    >
      <aside className="sidebar" aria-label="Primary navigation">
        <strong>Plutus</strong>
        <nav>
          <a href="/dashboard?scenario=mvp">Dashboard</a>
          <a href="/portfolios?scenario=mvp">Portfolios</a>
          <a href="/watchlists?scenario=mvp">Watchlists</a>
          <a href="/runs?scenario=mvp">Runs</a>
          <a href="/memory?scenario=mvp">Memory</a>
          <a href="/wiki?scenario=mvp">Wiki</a>
          <a href="/settings/remote-control?scenario=mvp">Remote</a>
        </nav>
      </aside>
      <section className="main-surface">{children}</section>
    </main>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="mobile-shell"
      data-testid="route-surface"
      data-route-kind="remote"
    >
      <nav className="mobile-tabs" aria-label="Remote navigation">
        <a href="/remote/dashboard?scenario=mvp&remote=connected">Home</a>
        <a href="/remote/runs?scenario=mvp&remote=connected">Runs</a>
        <a href="/remote/settings?scenario=mvp&remote=connected">Settings</a>
      </nav>
      {children}
    </main>
  );
}

export function RiskWarning() {
  return (
    <section className="risk-warning" data-testid="risk-warning">
      <strong>Risk warning</strong>
      <span>
        BTC and NVDA combined exposure exceeds the review threshold. Inspect
        concentration, correlation, stale quote data, and liquidity assumptions
        before any rebalance candidate is considered. Past performance does not
        guarantee future results.
      </span>
    </section>
  );
}

export function RiskChart() {
  return (
    <div
      className="chart"
      data-testid="artifact-chart"
      data-rendered="true"
      aria-label="BTC and NVDA exposure chart"
    >
      <svg
        data-testid="risk-chart"
        viewBox="0 0 320 120"
        role="img"
        aria-label="BTC and NVDA exposure line chart"
      >
        <rect x="0" y="0" width="320" height="120" fill="#f7fafc" />
        <polyline
          points="10,90 70,80 130,55 190,70 250,35 310,28"
          fill="none"
          stroke="#1f7a5f"
          strokeWidth="4"
        />
        <polyline
          points="10,100 70,92 130,82 190,75 250,68 310,60"
          fill="none"
          stroke="#b24724"
          strokeWidth="4"
        />
      </svg>
      <span style={{ height: "76%" }}>BTC</span>
      <span style={{ height: "62%" }}>NVDA</span>
      <span style={{ height: "38%" }}>Cash</span>
    </div>
  );
}

export function ArtifactList({ scenario }: { scenario: PlutusScenario }) {
  return (
    <section className="artifact-list" data-testid="artifact-list">
      <h2>Artifacts</h2>
      {scenario.run.artifacts.map((artifact) => (
        <a
          key={artifact.id}
          href={`/runs/${scenario.run.id}/artifacts/${artifact.id}?scenario=mvp`}
          aria-label={`Open ${artifact.name}`}
        >
          {artifact.name}
        </a>
      ))}
    </section>
  );
}

export function HostDashboard({ scenario }: { scenario: PlutusScenario }) {
  return (
    <HostShell>
      <header className="page-header">
        <p className="eyebrow">Seeded scenario mode</p>
        <h1>Plutus Research Desk</h1>
        <h2>Host Dashboard</h2>
      </header>
      <section className="grid two">
        <PortfolioSummary scenario={scenario} />
        <article className="panel">
          <h2>Current guardrail</h2>
          <RiskWarning />
        </article>
        <article className="panel">
          <h2>Run Progress</h2>
          <RunStageList />
        </article>
        <article className="panel">
          <h2>Artifacts</h2>
          <p data-testid="artifact-title">BTC/NVDA Risk Review</p>
          <RiskChart />
        </article>
      </section>
    </HostShell>
  );
}

export function PortfolioSummary({ scenario }: { scenario: PlutusScenario }) {
  return (
    <article className="panel" data-testid="portfolio-core">
      <h2>{scenario.portfolio.name} portfolio</h2>
      <p data-testid="portfolio-name">{scenario.portfolio.name}</p>
      <p className="metric">{formatCurrency(scenario.portfolio.value)}</p>
      <div className="position-list">
        {scenario.portfolio.positions.map((position) => (
          <div className="row" key={position.symbol}>
            <span>{position.symbol}</span>
            <strong>{position.allocation}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function PortfoliosPage({ scenario }: { scenario: PlutusScenario }) {
  return (
    <HostShell>
      <h1>Portfolios</h1>
      <PortfolioRows scenario={scenario} />
    </HostShell>
  );
}

export function PortfolioDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  return (
    <HostShell>
      <h1>Core Portfolio</h1>
      <PortfolioRows scenario={scenario} />
      <section className="panel">
        <h2>Position Thesis Notes</h2>
        {scenario.portfolio.positions.map((position) => (
          <p key={position.symbol}>
            <strong>{position.symbol}</strong>: {position.thesis}
          </p>
        ))}
      </section>
    </HostShell>
  );
}

function PortfolioRows({ scenario }: { scenario: PlutusScenario }) {
  return (
    <article className="panel" data-testid="portfolio-core">
      <h2>{scenario.portfolio.name}</h2>
      {scenario.portfolio.positions.map((position) => (
        <div className="row" key={position.symbol}>
          <span>
            {position.symbol} - {position.name}
          </span>
          <strong>{formatCurrency(position.value)}</strong>
        </div>
      ))}
    </article>
  );
}

export function WatchlistsPage({ scenario }: { scenario: PlutusScenario }) {
  return (
    <HostShell>
      <h1>Watchlists</h1>
      <WatchlistPanel scenario={scenario} title={scenario.watchlist.name} />
    </HostShell>
  );
}

export function WatchlistDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  return (
    <HostShell>
      <h1>Default Watchlist</h1>
      <WatchlistPanel scenario={scenario} title="Watchlist Notes" />
      <section className="panel">
        <h2>Editable Notes</h2>
        <p>NVDA note: validate AI capex assumptions before the next run.</p>
      </section>
    </HostShell>
  );
}

function WatchlistPanel({
  scenario,
  title,
}: {
  scenario: PlutusScenario;
  title: string;
}) {
  return (
    <article className="panel" data-testid="watchlist-default">
      <h2>{title}</h2>
      <div className="pill-row">
        {scenario.watchlist.items.map((symbol) => (
          <span className="pill" key={symbol}>
            {symbol}
          </span>
        ))}
      </div>
    </article>
  );
}

export function InstrumentDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  return (
    <HostShell>
      <h1>BTC Instrument</h1>
      <section className="panel">
        <h2>
          {scenario.instrument.symbol} - {scenario.instrument.name}
        </h2>
        <p>{scenario.instrument.summary}</p>
        <RiskChart />
      </section>
    </HostShell>
  );
}

export function RunsPage({ scenario }: { scenario: PlutusScenario }) {
  const [started, setStarted] = useState(false);
  return (
    <HostShell>
      <h1>BTC/NVDA Risk Review</h1>
      <h2>Research Runs</h2>
      <button className="primary" onClick={() => setStarted(true)}>
        Start BTC/NVDA Review
      </button>
      <section className="panel run-panel">
        {started ? (
          <div data-testid="run-progress">{scenario.run.status}</div>
        ) : (
          <RunStageList />
        )}
        <RiskWarning />
        <div data-testid="final-run-card" className="final-card">
          Final category: {scenario.run.category}
        </div>
        <ArtifactList scenario={scenario} />
      </section>
      <section className="panel">
        <h2>Memory</h2>
        <p>Captured: BTC and NVDA concentration needs periodic review.</p>
      </section>
      <section className="panel">
        <h2>Wiki</h2>
        <p>
          BTC/NVDA concentration lesson with source-linked revision history and
          revert action.
        </p>
      </section>
    </HostShell>
  );
}

function RunStageList() {
  return (
    <ol data-testid="run-progress">
      {[
        "planning",
        "grounding",
        "executing",
        "debating",
        "validating",
        "reporting",
        "completed",
      ].map((stage) => (
        <li key={stage}>{stage}</li>
      ))}
    </ol>
  );
}

export function RunDetailPage({ scenario }: { scenario: PlutusScenario }) {
  return (
    <HostShell>
      <h1>{scenario.run.title}</h1>
      <RiskChart />
      <RiskWarning />
      <ArtifactList scenario={scenario} />
    </HostShell>
  );
}

export function ArtifactDetailPage() {
  return (
    <HostShell>
      <h1>BTC NVDA Risk Report</h1>
      <RiskWarning />
      <p>
        Generated locally in the Mac app data directory and opened through the
        typed artifact command.
      </p>
    </HostShell>
  );
}

export function StrategiesPage() {
  return (
    <HostShell>
      <h1>Strategies</h1>
      <section className="panel">
        <h2>Strategy Specs</h2>
        <p>Risk trim strategy spec generated from the completed run.</p>
      </section>
    </HostShell>
  );
}

export function MemoryPage({ scenario }: { scenario: PlutusScenario }) {
  return (
    <HostShell>
      <h1>Memory Activity</h1>
      <section className="grid two">
        <article className="panel" data-testid="memory-activity-feed">
          <h2>Activity Feed</h2>
          <p>
            {scenario.memory.activity}: {scenario.memory.summary}
          </p>
          <div className="button-row">
            <button className="secondary">Edit memory</button>
            <button className="secondary">Pin memory</button>
            <button className="secondary">Archive memory</button>
            <button className="secondary">Forget memory</button>
          </div>
        </article>
        <article className="panel">
          <h2>Category Toggles</h2>
          <label className="toggle-row">
            <input type="checkbox" defaultChecked />
            Research memory capture
          </label>
          <label className="toggle-row">
            <input type="checkbox" defaultChecked />
            Wiki pointer memory
          </label>
        </article>
      </section>
    </HostShell>
  );
}

export function WikiPage({
  scenario,
  detail,
}: {
  scenario: PlutusScenario;
  detail: boolean;
}) {
  return (
    <HostShell>
      <h1>{detail ? scenario.wiki.title : "Wiki Browser"}</h1>
      <section className="grid two">
        <article className="panel">
          <h2>Wiki Activity Feed</h2>
          <p>LLM Wiki Curator updated a source-linked risk lesson.</p>
        </article>
        <article className="panel" data-testid="wiki-revision-timeline">
          <h2>Revision Timeline</h2>
          <p>Revision: {scenario.wiki.revision}</p>
          <button className="secondary">Revert revision</button>
        </article>
        <article className="panel" data-testid="source-link-drawer">
          <h2>Source Links</h2>
          <p>{scenario.wiki.sourceRef}</p>
        </article>
        <article className="panel">
          <h2>Diff View</h2>
          <p>Added concentration lesson and stale quote warning.</p>
        </article>
      </section>
    </HostShell>
  );
}

export function SettingsPage({ title }: { title: string }) {
  return (
    <HostShell>
      <h1>{title}</h1>
      <section className="panel">
        <p>
          Seeded MVP preview route for local command and Tauri webview
          inspection.
        </p>
      </section>
    </HostShell>
  );
}

export function RemoteControlSettingsPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  return (
    <HostShell>
      <h1>Remote Control</h1>
      <section className="panel">
        <div className="row">
          <span>Status</span>
          <strong>Enabled</strong>
        </div>
        <div className="row">
          <span>Pairing code</span>
          <strong data-testid="pairing-code">
            {scenario.remoteDevice.pairingCode}
          </strong>
        </div>
        <div className="row">
          <span>Connected device</span>
          <strong>{scenario.remoteDevice.name}</strong>
        </div>
        <button className="secondary">Revoke Eunsoo iPhone</button>
      </section>
    </HostShell>
  );
}

export function PairPage({ scenario }: { scenario: PlutusScenario }) {
  return (
    <MobileShell>
      <h1>Pair With Mac</h1>
      <section className="panel">
        <p>Scan QR code or enter the short-lived pairing code.</p>
        <div className="pair-code">{scenario.remoteDevice.pairingCode}</div>
      </section>
    </MobileShell>
  );
}

export function RemoteStateBanner({ remote }: { remote: RemoteVisualState }) {
  return (
    <>
      <section className={`remote-state ${remote}`} data-testid="remote-state">
        {remoteStateLabel(remote)}
      </section>
      <span data-testid="connection-state">{remote}</span>
    </>
  );
}

export function ConnectionPage({ remote }: { remote: RemoteVisualState }) {
  return (
    <MobileShell>
      <h1>Connection</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>Host identity: Eunsoo MacBook Plutus</p>
        <p>Heartbeat and reconnect status are shown before mutations unlock.</p>
      </section>
    </MobileShell>
  );
}

export function RemoteDashboardPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  const disabled = remote !== "connected";
  return (
    <MobileShell>
      <h1>Remote Dashboard</h1>
      <RemoteStateBanner remote={remote} />
      {remote === "revoked" ? (
        <section className="risk-warning" data-testid="remote-command-error">
          Remote command denied: permission revoked
        </section>
      ) : null}
      <article className="panel" data-testid="portfolio-core">
        <p>Mobile Remote Controller</p>
        <p>{scenario.portfolio.name}: BTC, NVDA, USDC</p>
        <button
          className="primary"
          data-testid="remote-command"
          aria-label="Start Remote BTC/NVDA Review"
          disabled={disabled}
        >
          {remote === "revoked"
            ? "Remote command denied"
            : "Start Mac-hosted run"}
        </button>
      </article>
    </MobileShell>
  );
}

export function RemotePortfolioPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  return (
    <MobileShell>
      <h1>Remote Core Portfolio</h1>
      <RemoteStateBanner remote={remote} />
      <PortfolioSummary scenario={scenario} />
      <section className="panel">
        <h2>Remote Thesis Edit</h2>
        <p>Position thesis notes are editable only while connected.</p>
      </section>
    </MobileShell>
  );
}

export function RemoteWatchlistPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  return (
    <MobileShell>
      <h1>Remote Default Watchlist</h1>
      <RemoteStateBanner remote={remote} />
      <WatchlistPanel scenario={scenario} title={scenario.watchlist.name} />
      <section className="panel">
        <h2>Remote Note Edit</h2>
        <p>
          Watchlist notes are disabled when the host is stale or disconnected.
        </p>
      </section>
    </MobileShell>
  );
}

export function RemoteRunsPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  return (
    <MobileShell>
      <h1>Remote Runs</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{scenario.run.title}</p>
        <RiskWarning />
      </section>
    </MobileShell>
  );
}

export function RemoteRunDetailPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  return (
    <MobileShell>
      <h1>Remote Run Detail</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{scenario.run.status}</p>
        <RunStageList />
        <button className="secondary" disabled={remote !== "connected"}>
          Cancel Mac-hosted run
        </button>
      </section>
    </MobileShell>
  );
}

export function RemoteArtifactPage({ remote }: { remote: RemoteVisualState }) {
  return (
    <MobileShell>
      <h1>Remote Artifact</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <RiskChart />
        <p>Compact artifact summary streamed from the Mac host.</p>
      </section>
    </MobileShell>
  );
}

export function RemoteMemoryPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  return (
    <MobileShell>
      <h1>Remote Memory</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel" data-testid="memory-activity-feed">
        <p>{scenario.memory.summary}</p>
        <p>Read-only on mobile for MVP.</p>
      </section>
    </MobileShell>
  );
}

export function RemoteWikiPage({
  scenario,
  remote,
  detail,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  detail: boolean;
}) {
  return (
    <MobileShell>
      <h1>{detail ? "Remote Wiki Page" : "Remote Wiki"}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <h2>{scenario.wiki.title}</h2>
        <p>Read-only wiki activity and page summary.</p>
      </section>
    </MobileShell>
  );
}

export function RemoteSettingsPage({ remote }: { remote: RemoteVisualState }) {
  return (
    <MobileShell>
      <h1>Remote Settings</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>Biometric unlock required before sensitive remote-control access.</p>
      </section>
    </MobileShell>
  );
}
