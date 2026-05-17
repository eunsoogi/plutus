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
  PairPage,
  PortfolioDetailPage,
  PortfoliosPage,
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
  type PlutusScenario,
  type PlutusCommandClient,
  type RemoteVisualState,
} from "@plutus/ui";
import { seededScenario } from "../features/seeded-scenario";

declare global {
  interface Window {
    __PLUTUS_COMMAND_BRIDGE__?: CommandBridge;
  }
}

export type PlutusRouteContext = {
  path: string;
  remote: RemoteVisualState;
  scenario?: PlutusScenario;
  commandClient?: PlutusCommandClient;
};

export const hostRoutePaths = [
  "/dashboard",
  "/portfolios",
  "/portfolios/:portfolioId",
  "/watchlists",
  "/watchlists/:watchlistId",
  "/instruments/:instrumentId",
  "/runs",
  "/runs/:runId",
  "/runs/:runId/artifacts/:artifactId",
  "/strategies",
  "/memory",
  "/wiki",
  "/wiki/:pageId",
  "/settings/security",
  "/settings/providers",
  "/settings/remote-control",
  "/settings/import-export",
] as const;

export const mobileRoutePaths = [
  "/pair",
  "/connection",
  "/remote/dashboard",
  "/remote/portfolios/:portfolioId",
  "/remote/watchlists/:watchlistId",
  "/remote/instruments/:instrumentId",
  "/remote/runs",
  "/remote/runs/:runId",
  "/remote/artifacts/:artifactId",
  "/remote/memory",
  "/remote/wiki",
  "/remote/wiki/:pageId",
  "/remote/settings",
] as const;

export function renderPlutusRoute({
  path,
  remote,
  scenario = seededScenario,
  commandClient,
}: PlutusRouteContext): ReactElement {
  const resolvedCommandClient =
    commandClient ??
    (typeof window !== "undefined" && window.__PLUTUS_COMMAND_BRIDGE__
      ? createCommandClient(window.__PLUTUS_COMMAND_BRIDGE__)
      : undefined);

  if (path === "/" || path === "/dashboard") {
    return <HostDashboard scenario={scenario} />;
  }
  if (path === "/portfolios") {
    return <PortfoliosPage scenario={scenario} />;
  }
  if (path.startsWith("/portfolios/")) {
    return <PortfolioDetailPage scenario={scenario} />;
  }
  if (path === "/watchlists") {
    return <WatchlistsPage scenario={scenario} />;
  }
  if (path.startsWith("/watchlists/")) {
    return <WatchlistDetailPage scenario={scenario} />;
  }
  if (path.startsWith("/instruments/")) {
    return <InstrumentDetailPage scenario={scenario} />;
  }
  if (path === "/runs") {
    return (
      <RunsPage scenario={scenario} commandClient={resolvedCommandClient} />
    );
  }
  if (path.startsWith("/runs/") && path.includes("/artifacts/")) {
    const artifactId = path.split("/artifacts/")[1];
    return (
      <ArtifactDetailPage
        scenario={scenario}
        commandClient={resolvedCommandClient}
        artifactId={artifactId}
      />
    );
  }
  if (path.startsWith("/runs/")) {
    return <RunDetailPage scenario={scenario} />;
  }
  if (path === "/strategies") {
    return <StrategiesPage />;
  }
  if (path === "/memory") {
    return (
      <MemoryPage scenario={scenario} commandClient={resolvedCommandClient} />
    );
  }
  if (path === "/wiki") {
    return (
      <WikiPage
        scenario={scenario}
        detail={false}
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (path.startsWith("/wiki/")) {
    return (
      <WikiPage
        scenario={scenario}
        detail
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (path === "/settings/security") {
    return <SettingsPage title="Security Settings" />;
  }
  if (path === "/settings/providers") {
    return <SettingsPage title="Provider Settings" />;
  }
  if (path === "/settings/remote-control") {
    return <RemoteControlSettingsPage scenario={scenario} />;
  }
  if (path === "/settings/import-export") {
    return <SettingsPage title="Import Export" />;
  }
  if (path === "/pair") {
    return <PairPage scenario={scenario} />;
  }
  if (path === "/connection") {
    return <ConnectionPage remote={remote} />;
  }
  if (path === "/remote/dashboard") {
    return (
      <RemoteDashboardPage
        scenario={scenario}
        remote={remote}
        commandClient={resolvedCommandClient}
      />
    );
  }
  if (path.startsWith("/remote/portfolios/")) {
    return <RemotePortfolioPage scenario={scenario} remote={remote} />;
  }
  if (path.startsWith("/remote/watchlists/")) {
    return <RemoteWatchlistPage scenario={scenario} remote={remote} />;
  }
  if (path.startsWith("/remote/instruments/")) {
    return <RemoteInstrumentPage scenario={scenario} remote={remote} />;
  }
  if (path === "/remote/runs") {
    return <RemoteRunsPage scenario={scenario} remote={remote} />;
  }
  if (path.startsWith("/remote/runs/")) {
    return <RemoteRunDetailPage scenario={scenario} remote={remote} />;
  }
  if (path.startsWith("/remote/artifacts/")) {
    return <RemoteArtifactPage remote={remote} />;
  }
  if (path === "/remote/memory") {
    return <RemoteMemoryPage scenario={scenario} remote={remote} />;
  }
  if (path === "/remote/wiki") {
    return (
      <RemoteWikiPage scenario={scenario} remote={remote} detail={false} />
    );
  }
  if (path.startsWith("/remote/wiki/")) {
    return <RemoteWikiPage scenario={scenario} remote={remote} detail />;
  }
  if (path === "/remote/settings") {
    return <RemoteSettingsPage remote={remote} />;
  }
  return <SettingsPage title="Not Found" />;
}
