# Plutus Spec: Apps, Local Commands, And Remote Control

## 1. Goal

Specify the local-first app surfaces, Tauri command bridge, Mac-hosted remote-control service, mobile controller behavior, local event streams, and connection behavior for MVP.

MVP must not require a hosted API server, PostgreSQL, Redis, object storage, or server-managed sync.

## 2. App Architecture

One Tauri 2 codebase produces:

- macOS host app;
- iOS remote-control app;
- Android remote-control app.

The macOS host app owns the source of truth: SQLite database, Codex runtime, local tool router, backtest execution, artifact files, audit log, and remote-control service.

The mobile app is a paired controller and viewer for the Mac host.

`apps/web-preview` must render the same route components behind a browser development server so Codex can inspect desktop and mobile layouts through the in-app browser before UI work is considered complete.

## 3. Primary Routes

macOS host routes:

```text
/dashboard
/portfolios
/portfolios/:portfolioId
/watchlists
/watchlists/:watchlistId
/instruments/:instrumentId
/runs
/runs/:runId
/runs/:runId/artifacts/:artifactId
/strategies
/memory
/wiki
/wiki/:pageId
/settings/security
/settings/providers
/settings/remote-control
/settings/import-export
```

Mobile controller routes:

```text
/pair
/connection
/remote/dashboard
/remote/portfolios/:portfolioId
/remote/watchlists/:watchlistId
/remote/runs
/remote/runs/:runId
/remote/artifacts/:artifactId
/remote/memory
/remote/wiki
/remote/wiki/:pageId
/remote/settings
```

## 4. Mac Local Command Surface

The Mac app exposes typed local commands instead of HTTP API routes.

```ts
export interface PlutusLocalCommands {
  portfolios: {
    list(): Promise<Portfolio[]>;
    create(input: CreatePortfolioInput): Promise<Portfolio>;
    getSnapshot(input: GetPortfolioSnapshotInput): Promise<PortfolioSnapshot>;
    addPosition(input: AddPositionInput): Promise<Position>;
    updatePosition(input: UpdatePositionInput): Promise<Position>;
    updatePositionThesis(input: UpdatePositionThesisInput): Promise<Position>;
  };
  watchlists: {
    list(): Promise<Watchlist[]>;
    create(input: CreateWatchlistInput): Promise<Watchlist>;
    addItem(input: AddWatchlistItemInput): Promise<WatchlistItem>;
    updateItem(input: UpdateWatchlistItemInput): Promise<WatchlistItem>;
  };
  researchRuns: {
    start(input: StartResearchRunInput): Promise<ResearchRun>;
    get(runId: string): Promise<ResearchRunDetail>;
    cancel(runId: string): Promise<void>;
  };
  artifacts: {
    get(artifactId: string): Promise<ArtifactDetail>;
    openLocalFile(artifactId: string): Promise<void>;
  };
  memory: {
    listActivity(input: MemoryActivityQuery): Promise<MemoryActivityItem[]>;
    update(memoryId: string, patch: MemoryPatch): Promise<MemoryRecord>;
    archive(memoryId: string, reason: string): Promise<void>;
    forget(memoryId: string): Promise<void>;
    setCategoryEnabled(category: string, enabled: boolean): Promise<void>;
  };
  wiki: {
    listPages(input: WikiPageQuery): Promise<WikiPageSummary[]>;
    getPage(pageId: string): Promise<WikiPageDetail>;
    listActivity(input: WikiActivityQuery): Promise<WikiActivityItem[]>;
    revertRevision(pageId: string, revisionId: string, reason: string): Promise<WikiPageDetail>;
  };
}
```

## 5. Remote-Control Command Surface

Mobile sends typed commands to the Mac host. The Mac host executes them against the same local command layer after checking paired-device permissions.

```ts
export const RemoteCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("portfolio.list") }),
  z.object({ type: z.literal("portfolio.snapshot"), portfolioId: z.string().uuid() }),
  z.object({ type: z.literal("portfolio.update_position_thesis"), payload: UpdatePositionThesisInputSchema }),
  z.object({ type: z.literal("watchlist.list") }),
  z.object({ type: z.literal("watchlist.update_item"), payload: UpdateWatchlistItemInputSchema }),
  z.object({ type: z.literal("run.start"), payload: StartResearchRunInputSchema }),
  z.object({ type: z.literal("run.get"), runId: z.string().uuid() }),
  z.object({ type: z.literal("run.cancel"), runId: z.string().uuid() }),
  z.object({ type: z.literal("artifact.get"), artifactId: z.string().uuid() }),
  z.object({ type: z.literal("memory.activity") }),
  z.object({ type: z.literal("wiki.list") }),
  z.object({ type: z.literal("wiki.get"), pageId: z.string().uuid() }),
]);
```

Remote responses include:

- command ID;
- success/failure;
- data payload;
- warning list;
- host timestamp;
- permission result.

## 6. Pairing And Transport

MVP remote-control flow:

1. User enables remote control on the Mac host.
2. Mac host shows QR code and short-lived pairing code.
3. Mobile scans or enters the pairing code.
4. Mac host creates a device-specific session key.
5. Mobile stores the paired host identity in platform secure storage.
6. Mac host displays the connected device and allows revocation.

Transport requirements:

- local network discovery where platform rules allow;
- manual host address entry when local discovery is unavailable;
- encrypted session transport;
- heartbeat and reconnect;
- stale-session detection;
- host-side kill switch;
- no Plutus-hosted relay server in MVP.

If the Mac host is unreachable, mobile shows disconnected/stale state and does not allow mutations.

## 7. macOS Host UX Surface

macOS must support:

- multi-pane research workspace;
- portfolio dashboard;
- watchlist and instrument detail;
- agent run composer;
- local run progress;
- artifact viewer for run cards, reports, charts, and strategy specs;
- local secure credential storage through Keychain;
- local backtest and report generation;
- remote-control settings with enable/disable, pairing, connected devices, and revoke controls.

## 8. Mobile Remote-Control UX Surface

Mobile must support:

- pair with Mac host;
- show connected host identity and connection state;
- view Mac-hosted portfolio overview;
- view Mac-hosted watchlist overview;
- view Mac-hosted instrument summaries;
- view Mac-hosted run history;
- start a Mac-hosted research run;
- cancel a Mac-hosted research run;
- show live Mac-hosted run progress;
- view compact run summaries and full artifacts from the Mac host;
- edit Mac-hosted watchlist notes and position thesis notes;
- require biometric unlock before sensitive remote-control access.

Mobile does not run Codex, market-data jobs, or heavyweight backtests locally in MVP.

## 9. Local Events

Mac host emits local UI events and forwards permitted events to paired mobile devices:

```text
run.status_changed
run.stage_started
run.stage_completed
agent.message
tool.call_started
tool.call_completed
warning.registered
artifact.created
notification.created
run.completed
run.failed
remote.device_connected
remote.device_disconnected
remote.permission_denied
```

Mobile treats events as progress. The Mac host SQLite database remains the source of truth.

## 10. Local Storage

MVP local storage on Mac:

- SQLite database for portfolios, watchlists, instruments, runs, strategies, backtests, artifacts, remote devices, and audit rows.
- App data directory for report files, chart JSON, generated strategy files, and exported backup bundles.
- Secure storage for provider keys and remote-control secrets.
- SQLite-backed local queue for long-running backtests and Codex stages.

Mobile local storage:

- paired host identity;
- session keys;
- small read-only stale snapshot for disconnected display;
- no independent source-of-truth portfolio database in MVP.

## 11. Import/Export And Future Remote Access

MVP may support local export/backup from the Mac host, but mobile control does not depend on export/import.

Post-MVP options:

- user-managed remote access outside the local network through VPN/Tailscale-like networking;
- optional encrypted backup bundles;
- optional platform push notifications after a separate design;
- optional hosted relay only after a separate PRD.

## 12. Acceptance Tests

- User enables remote control on Mac and pairs a mobile device.
- Mobile lists Mac-hosted portfolios while connected.
- Mobile starts a research run and the Mac host executes it.
- Mobile receives live run progress from the Mac host.
- Mobile cancels a running Mac-hosted run.
- Mobile edits a watchlist note and the Mac app reflects it.
- Mac host revokes the mobile device and subsequent mobile commands fail.
- MVP works without a Plutus-hosted backend, PostgreSQL, Redis, or server-managed sync.
- Playwright covers the route flows above through `apps/web-preview` at desktop and phone viewports.
- Codex in-app browser inspection confirms risk warnings, stale/disconnected states, artifacts, charts, and primary actions render without layout overlap.
