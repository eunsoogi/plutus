import type { ReactElement } from "react";
import {
  createCommandClient,
  type CommandBridge,
} from "@plutus/command-client";
import {
  ArtifactDetailPage,
  ConnectionPage,
  HostDashboard,
  InstrumentDetailPage,
  MemoryPage,
  NotFoundPage,
  PairPage,
  PortfolioDetailPage,
  PortfoliosPage,
  ProviderSettingsPage,
  RemoteArtifactPage,
  RemoteControlSettingsPage,
  RemoteDashboardPage,
  RemoteInstrumentPage,
  RemoteMemoryPage,
  RemotePortfolioPage,
  RemoteRunDetailPage,
  RemoteRunsPage,
  RemoteSettingsPage,
  RemoteWatchlistPage,
  RemoteWikiPage,
  RunDetailPage,
  RunsPage,
  SettingsPage,
  StrategiesPage,
  WatchlistDetailPage,
  WatchlistsPage,
  WikiPage,
  RuntimeUnavailablePage,
} from "@plutus/ui";

import { emptyAppScenario } from "./plutus-empty-scenario";
import {
  artifactRoute,
  oneSegmentRoute,
  remoteOneSegmentRoute,
} from "./plutus-route-matchers";
import { isKnownHostRoute } from "./plutus-route-paths";
import { routeId } from "./plutus-snapshot";
import type { PlutusRouteContext } from "./plutus-route-types";

declare global {
  interface Window {
    __PLUTUS_COMMAND_BRIDGE__?: CommandBridge;
  }
}

export function renderPlutusRouteContent({
  path,
  remote,
  scenario,
  commandClient,
  refreshScenario,
}: PlutusRouteContext): ReactElement {
  const resolvedCommandClient =
    commandClient ??
    (typeof window !== "undefined" && window.__PLUTUS_COMMAND_BRIDGE__
      ? createCommandClient(window.__PLUTUS_COMMAND_BRIDGE__)
      : undefined);
  const resolvedScenario = scenario ?? emptyAppScenario;

  const canRenderWithoutRuntime =
    path.startsWith("/remote") || path === "/connection" || path === "/pair";
  const knownHostRoute = isKnownHostRoute(path);

  if (!canRenderWithoutRuntime && !knownHostRoute) {
    return <NotFoundPage />;
  }

  if (!scenario && !resolvedCommandClient && !canRenderWithoutRuntime) {
    return <RuntimeUnavailablePage />;
  }

  if (path === "/" || path === "/dashboard") {
    return <HostDashboard scenario={resolvedScenario} />;
  }
  if (path === "/portfolios") {
    return (
      <PortfoliosPage
        scenario={resolvedScenario}
        commandClient={resolvedCommandClient}
        refreshScenario={refreshScenario}
      />
    );
  }
  if (oneSegmentRoute(path, "portfolios")) {
    return <PortfolioDetailPage scenario={resolvedScenario} />;
  }
  if (path === "/watchlists") {
    return <WatchlistsPage scenario={resolvedScenario} />;
  }
  if (oneSegmentRoute(path, "watchlists")) {
    return <WatchlistDetailPage scenario={resolvedScenario} />;
  }
  if (oneSegmentRoute(path, "instruments")) {
    return <InstrumentDetailPage scenario={resolvedScenario} />;
  }
  if (path === "/runs") {
    return (
      <RunsPage
        scenario={resolvedScenario}
        commandClient={resolvedCommandClient}
        refreshScenario={refreshScenario}
      />
    );
  }
  if (artifactRoute(path)) {
    const runId = routeId(path, "/runs");
    const artifactId = path.split("/artifacts/")[1];
    return (
      <ArtifactDetailPage
        scenario={resolvedScenario}
        commandClient={resolvedCommandClient}
        artifactId={artifactId}
        runId={runId}
      />
    );
  }
  if (oneSegmentRoute(path, "runs")) {
    return <RunDetailPage scenario={resolvedScenario} />;
  }
  if (path === "/strategies") {
    return <StrategiesPage />;
  }
  if (path === "/memory") {
    return (
      <MemoryPage
        scenario={resolvedScenario}
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (path === "/wiki") {
    return (
      <WikiPage
        scenario={resolvedScenario}
        detail={false}
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (oneSegmentRoute(path, "wiki")) {
    return (
      <WikiPage
        scenario={resolvedScenario}
        detail
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (path === "/settings/security") {
    return <SettingsPage title="Security Settings" />;
  }
  if (path === "/settings/providers") {
    return <ProviderSettingsPage commandClient={resolvedCommandClient} />;
  }
  if (path === "/settings/preferences") {
    return <SettingsPage title="Preferences" />;
  }
  if (path === "/settings/remote-control") {
    return <RemoteControlSettingsPage scenario={resolvedScenario} />;
  }
  if (path === "/settings/import-export") {
    return <SettingsPage title="Import Export" />;
  }
  if (path === "/pair") {
    return <PairPage scenario={resolvedScenario} />;
  }
  if (path === "/connection") {
    return <ConnectionPage remote={remote} />;
  }
  if (path === "/remote/dashboard") {
    return (
      <RemoteDashboardPage
        scenario={resolvedScenario}
        remote={remote}
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (remoteOneSegmentRoute(path, "portfolios")) {
    return (
      <RemotePortfolioPage
        scenario={resolvedScenario}
        remote={remote}
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (remoteOneSegmentRoute(path, "watchlists")) {
    return (
      <RemoteWatchlistPage
        scenario={resolvedScenario}
        remote={remote}
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (remoteOneSegmentRoute(path, "instruments")) {
    return <RemoteInstrumentPage scenario={resolvedScenario} remote={remote} />;
  }
  if (path === "/remote/runs") {
    return <RemoteRunsPage scenario={resolvedScenario} remote={remote} />;
  }
  if (remoteOneSegmentRoute(path, "runs")) {
    return (
      <RemoteRunDetailPage
        scenario={resolvedScenario}
        remote={remote}
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (remoteOneSegmentRoute(path, "artifacts")) {
    return <RemoteArtifactPage remote={remote} />;
  }
  if (path === "/remote/memory") {
    return <RemoteMemoryPage scenario={resolvedScenario} remote={remote} />;
  }
  if (path === "/remote/wiki") {
    return (
      <RemoteWikiPage
        scenario={resolvedScenario}
        remote={remote}
        detail={false}
      />
    );
  }
  if (remoteOneSegmentRoute(path, "wiki")) {
    return (
      <RemoteWikiPage scenario={resolvedScenario} remote={remote} detail />
    );
  }
  if (path === "/remote/settings") {
    return <RemoteSettingsPage remote={remote} />;
  }
  return <NotFoundPage />;
}
