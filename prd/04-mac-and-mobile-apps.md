# Plutus PRD: macOS Host And Mobile Remote Control

## 1. Objective

Deliver Plutus as a local-first macOS research workstation with a mobile app that remotely controls and views the Mac app.

The macOS app owns the portfolio database, Codex runtime, market-data adapters, backtest execution, reports, and artifacts. The mobile app is not an independent sync peer for MVP; it is a paired controller for the Mac host.

## 2. Platform Strategy

Use a shared TypeScript monorepo and Tauri 2 for the macOS host and mobile remote-control clients.

- Shared domain models, validation schemas, agent contracts, remote-control message schemas, and UI primitives.
- Shared React/Vite frontend where practical, with platform-specific routes for desktop host and mobile controller.
- macOS host app contains the local SQLite store, local tool router, Codex runtime bridge, backtest engine, artifact store, and remote-control service.
- Mobile app connects to the Mac host over a paired encrypted remote-control session.
- Browser preview/admin surface reuses the Tauri frontend routes for development only; it is not a product runtime.

Preferred choice:

- Use Tauri-only for the product app shells.
- Keep all MVP product data local to the Mac host.
- Use mobile as a companion controller: start runs, cancel runs, inspect progress, review summaries, open artifacts, edit watchlist notes, and request portfolio views from the Mac host.
- Avoid server-managed sync in MVP. Remote use outside the local network can be handled by user-managed networking such as VPN/Tailscale-like access in a later phase, not by a Plutus hosted backend.

## 3. macOS Host Requirements

macOS host app must support:

- Multi-pane research workspace.
- Portfolio dashboard.
- Watchlist and instrument detail views.
- Agent run composer.
- Streaming run progress.
- Artifact viewer for reports, charts, strategy specs, and run cards.
- Local secure credential storage through macOS Keychain.
- Local SQLite product database.
- Local artifact storage in the app data directory.
- Local sandbox worker for generated strategy artifacts and MVP backtests.
- Remote-control service with explicit user enablement.
- Pairing flow for mobile devices using QR code or short-lived pairing code.
- Session approval, session revocation, and visible connected-device status.

## 4. Mobile Remote-Control Requirements

Mobile app must support:

- Pair with the Mac host through QR code or short-lived pairing code.
- Show connection status and the active Mac host identity.
- View Mac-hosted portfolio overview.
- View Mac-hosted watchlist overview.
- View instrument detail summary fetched from the Mac host.
- View Mac-hosted research run history.
- Start a Mac-hosted research run from a lightweight composer.
- Cancel or pause a running Mac-hosted research run when allowed.
- Show live Mac-hosted run progress.
- View compact run summaries and full artifacts streamed from the Mac host.
- Edit watchlist notes and position thesis notes on the Mac host.
- Receive in-app remote notifications from the Mac host while connected.
- Use biometric lock before opening sensitive remote-control sessions.

Mobile should not run Codex, market-data jobs, or heavyweight backtests locally in MVP. Those operations run on the Mac host.

## 5. Remote-Control Transport Requirements

MVP remote-control transport must support:

- Mac host discovery on a local network where platform rules allow.
- Manual host address entry as a fallback.
- Encrypted session transport.
- Short-lived pairing tokens.
- Device-specific session keys.
- Command authorization per paired device.
- Local event stream from Mac host to mobile.
- Request/response commands for portfolio, watchlist, run, artifact, and settings views.
- Heartbeat, reconnect, and stale-session detection.
- Host-side kill switch to disable remote control immediately.

The MVP should not require a Plutus-hosted relay server. If direct connectivity is not available, the mobile app should explain that the Mac host is unreachable and let the user retry or enter a reachable host address.

## 6. Cross-Platform UX Requirements

- macOS remains the full workstation.
- Mobile presents compact controls that map to Mac-hosted state.
- All risk warnings must remain visible on mobile.
- Mobile summaries should be shorter, but full Mac-hosted artifacts must remain accessible while connected.
- The mobile UI must make clear when it is connected, disconnected, or viewing stale cached data.

## 7. Offline And Connection Behavior

MVP:

- Mobile can show a small cached snapshot of the last connected portfolio/watchlist/run summaries.
- Mobile cannot mutate Mac-hosted state while disconnected.
- Disconnected edits are not queued in MVP; the user must reconnect before editing.
- Mac host remains fully usable offline except for market-data provider calls and model/network calls required by Codex.

Post-MVP:

- Optional user-managed remote access outside the local network.
- Optional encrypted backup/export bundles.
- Optional push notifications routed through platform services after a separate design.

## 8. Acceptance Criteria

- User enables remote control in the macOS host app and pairs a mobile device.
- User starts a research run on macOS and watches live progress on mobile.
- User starts a research run from mobile and the Mac host executes it.
- User cancels a running Mac-hosted research run from mobile.
- User views a Mac-hosted backtest report on mobile.
- User edits a watchlist note from mobile and sees the change in the Mac app.
- Remote control can be revoked from the Mac host.
- The MVP works without a Plutus-hosted backend, PostgreSQL, Redis, or server-managed sync.
