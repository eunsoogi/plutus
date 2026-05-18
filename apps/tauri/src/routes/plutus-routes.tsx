import type { ReactElement } from "react";
import {
  createCommandClient,
  type AppSnapshot,
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
  type PlutusScenario,
  type PlutusCommandClient,
  type RemoteVisualState,
} from "@plutus/ui";

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
  refreshScenario?: () => Promise<PlutusScenario>;
};

export const emptyAppScenario: PlutusScenario = {
  profileId: "",
  portfolio: {
    id: "",
    name: "No portfolio yet",
    value: 0,
    positions: [],
  },
  watchlist: {
    id: "",
    name: "No watchlist yet",
    items: [],
  },
  instrument: {
    id: "",
    symbol: "",
    name: "No instrument selected",
    summary: "Create a portfolio or watchlist to inspect instruments.",
  },
  run: {
    id: "",
    title: "No research runs yet",
    status: "No runs yet",
    category: "",
    artifacts: [],
  },
  memory: {
    id: "",
    summary: "",
    activity: "No activity",
  },
  wiki: {
    id: "",
    title: "",
    revision: "",
    sourceRef: "",
  },
  remoteDevice: {
    name: "No paired device",
    pairingCode: "Not paired",
    sessionId: undefined,
    sessionKeyRef: undefined,
    unlockProof: undefined,
  },
};

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function displaySymbol(value: unknown) {
  return typeof value === "string" ? value.replace(/-USD$/, "") : "";
}

function displaySourceRef(ref: unknown): string {
  if (typeof ref === "string") return ref;
  if (!ref || typeof ref !== "object") return "";
  const record = ref as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : undefined;
  const id = typeof record.id === "string" ? record.id : undefined;
  if (type && id) return `${type}:${id}`;
  if (id) return id;
  return JSON.stringify(ref);
}

function routeId(path: string | undefined, marker: string) {
  if (!path) return undefined;
  const [, rest] = path.split(`${marker}/`);
  return rest?.split("/")[0] || undefined;
}

function routeSegments(path: string) {
  return path.split("/").filter(Boolean);
}

function oneSegmentRoute(path: string, root: string) {
  const segments = routeSegments(path);
  return segments.length === 2 && segments[0] === root;
}

function artifactRoute(path: string) {
  const segments = routeSegments(path);
  return (
    segments.length === 4 &&
    segments[0] === "runs" &&
    segments[2] === "artifacts"
  );
}

function remoteOneSegmentRoute(path: string, root: string) {
  const segments = routeSegments(path);
  return (
    segments.length === 3 && segments[0] === "remote" && segments[1] === root
  );
}

export function scenarioFromSnapshot(
  snapshot: AppSnapshot,
  path?: string,
): PlutusScenario {
  const portfolioId =
    routeId(path, "/portfolios") ?? routeId(path, "/remote/portfolios");
  const watchlistId =
    routeId(path, "/watchlists") ?? routeId(path, "/remote/watchlists");
  const runId = routeId(path, "/runs") ?? routeId(path, "/remote/runs");
  const portfolio = portfolioId
    ? snapshot.portfolios.find((candidate) => candidate.id === portfolioId)
    : snapshot.portfolios[0];
  const firstPosition = portfolio?.positions?.[0];
  const watchlist = watchlistId
    ? snapshot.watchlists.find((candidate) => candidate.id === watchlistId)
    : snapshot.watchlists[0];
  const run = runId
    ? snapshot.runs.find((candidate) => candidate.id === runId)
    : snapshot.runs[0];
  const artifacts = snapshot.artifacts.filter(
    (artifact) =>
      !run?.id ||
      (artifact as unknown as Record<string, unknown>).researchRunId === run.id,
  );
  const memory = snapshot.memoryActivity[0];
  const wiki = snapshot.wikiPages[0];
  const remoteDevice = snapshot.remoteDevices[0];
  const remoteDeviceRecord = remoteDevice as
    | Record<string, unknown>
    | undefined;
  const positions =
    portfolio?.positions?.map((position) => {
      const record = position as Record<string, unknown>;
      const quantity = asNumber(record.quantity);
      const averageCost = asNumber(record.averageCost);
      return {
        id: typeof record.id === "string" ? record.id : undefined,
        symbol: displaySymbol(record.symbol),
        name:
          typeof record.name === "string"
            ? record.name
            : displaySymbol(record.symbol),
        value: quantity * averageCost,
        allocation: quantity > 0 ? `${quantity}` : "0",
        thesis: typeof record.thesis === "string" ? record.thesis : "",
      };
    }) ?? [];
  const portfolioValue = positions.reduce(
    (total, position) => total + position.value,
    0,
  );

  return {
    profileId: snapshot.profileId,
    portfolio: {
      id: portfolio?.id ?? "",
      name: portfolio?.name ?? emptyAppScenario.portfolio.name,
      value: portfolioValue,
      positions,
    },
    watchlist: {
      id: watchlist?.id ?? "",
      name: watchlist?.name ?? emptyAppScenario.watchlist.name,
      items:
        watchlist?.items?.map((item) => {
          const record = item as Record<string, unknown>;
          return {
            id: typeof record.id === "string" ? record.id : undefined,
            symbol: displaySymbol(record.symbol),
            triggerNote:
              typeof record.triggerNote === "string" ? record.triggerNote : "",
          };
        }) ?? emptyAppScenario.watchlist.items,
    },
    instrument: {
      id:
        typeof firstPosition?.id === "string"
          ? firstPosition.id
          : emptyAppScenario.instrument.id,
      symbol: displaySymbol(firstPosition?.symbol),
      name:
        typeof (firstPosition as Record<string, unknown> | undefined)?.name ===
        "string"
          ? ((firstPosition as Record<string, unknown>).name as string)
          : emptyAppScenario.instrument.name,
      summary:
        typeof firstPosition?.thesis === "string"
          ? firstPosition.thesis
          : emptyAppScenario.instrument.summary,
    },
    run: {
      id: run?.id ?? "",
      title: run?.title ?? emptyAppScenario.run.title,
      status: run?.status ?? emptyAppScenario.run.status,
      category: run?.category ?? "",
      confidence: run?.confidence,
      finalCard:
        run?.finalCard && typeof run.finalCard === "object"
          ? (run.finalCard as PlutusScenario["run"]["finalCard"])
          : undefined,
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        name: artifact.title,
        type: artifact.type,
      })),
    },
    memory: {
      id:
        typeof memory?.memoryId === "string"
          ? memory.memoryId
          : emptyAppScenario.memory.id,
      summary:
        typeof memory?.payload === "object" &&
        memory.payload &&
        "summary" in memory.payload &&
        typeof memory.payload.summary === "string"
          ? memory.payload.summary
          : "",
      activity:
        typeof memory?.eventType === "string"
          ? memory.eventType
          : emptyAppScenario.memory.activity,
    },
    wiki: {
      id: typeof wiki?.id === "string" ? wiki.id : "",
      title: typeof wiki?.title === "string" ? wiki.title : "",
      revision:
        typeof wiki?.currentRevisionId === "string"
          ? wiki.currentRevisionId
          : "",
      sourceRef:
        Array.isArray(wiki?.sourceRefs) && wiki.sourceRefs.length > 0
          ? displaySourceRef(wiki.sourceRefs[0])
          : "",
    },
    remoteDevice: {
      name:
        typeof remoteDeviceRecord?.deviceName === "string"
          ? remoteDeviceRecord.deviceName
          : typeof remoteDeviceRecord?.device_name === "string"
            ? remoteDeviceRecord.device_name
            : typeof remoteDeviceRecord?.name === "string"
              ? remoteDeviceRecord.name
              : emptyAppScenario.remoteDevice.name,
      pairingCode:
        typeof remoteDeviceRecord?.pairingCode === "string"
          ? remoteDeviceRecord.pairingCode
          : typeof remoteDeviceRecord?.pairing_code === "string"
            ? remoteDeviceRecord.pairing_code
            : typeof remoteDeviceRecord?.pairingCodeHash === "string"
              ? "Paired"
              : typeof remoteDeviceRecord?.pairing_code_hash === "string"
                ? "Paired"
                : emptyAppScenario.remoteDevice.pairingCode,
      sessionId: undefined,
      sessionKeyRef: undefined,
      unlockProof: undefined,
    },
  };
}

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
  const knownHostRoute =
    path === "/" ||
    path === "/dashboard" ||
    path === "/portfolios" ||
    oneSegmentRoute(path, "portfolios") ||
    path === "/watchlists" ||
    oneSegmentRoute(path, "watchlists") ||
    oneSegmentRoute(path, "instruments") ||
    path === "/runs" ||
    oneSegmentRoute(path, "runs") ||
    artifactRoute(path) ||
    path === "/strategies" ||
    path === "/memory" ||
    path === "/wiki" ||
    oneSegmentRoute(path, "wiki") ||
    path === "/settings/security" ||
    path === "/settings/providers" ||
    path === "/settings/remote-control" ||
    path === "/settings/import-export";

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
    return <SettingsPage title="Provider Settings" />;
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
    return <RemoteRunDetailPage scenario={resolvedScenario} remote={remote} />;
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
