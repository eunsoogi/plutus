# Plutus PRD: macOS And Mobile Apps

## 1. Objective

Deliver a coherent cross-platform product where macOS is the deep research workstation and mobile is the portfolio review, notification, and lightweight agent interaction surface.

## 2. Platform Strategy

Use a shared TypeScript monorepo and Tauri 2 as the single app shell for macOS, iOS, and Android.

- Shared domain models, validation schemas, agent contracts, and API client.
- Shared design tokens and chart configuration.
- Shared React/Vite frontend compiled into Tauri.
- Platform-specific Rust, Swift, and Kotlin bindings only where native capabilities require them.

Recommended app stack:

- App shell: Tauri 2 for macOS, iOS, and Android.
- Frontend: React + Vite with responsive layouts for desktop and mobile.
- Browser preview/admin surface: Vite React route set reused from the Tauri frontend for development and operations only; it is not a second product app shell.
- Shared UI primitives: a small internal component system built for webview rendering.
- Native capabilities: official Tauri plugins first, custom Tauri mobile plugins only when required.

Preferred choice:

- Use Tauri-only for the product architecture. Tauri officially targets major desktop and mobile platforms from one codebase, can use any frontend that compiles to HTML/CSS/JavaScript, and provides Rust plus Swift/Kotlin bindings for native capability gaps.
- Keep an explicit mobile proof-of-capability checkpoint before beta for biometric lock, deep links, file import, app lifecycle, and store submission. Verify OS push notifications before the Phase 2 push-notification release. If any mobile capability requires additional work, solve it through Tauri configuration, official Tauri plugins, or custom Tauri mobile plugins.

## 3. macOS Requirements

macOS app must support:

- Multi-pane research workspace.
- Portfolio dashboard.
- Watchlist and instrument detail views.
- Agent run composer.
- Streaming run progress.
- Artifact viewer for reports, charts, strategy specs, and run cards.
- Local secure credential storage through macOS Keychain.
- Optional local sandbox worker for previewing generated strategy artifacts. Canonical backtest jobs run server-side for reproducibility and cross-device consistency.

## 4. Mobile Requirements

Mobile app must support:

- Portfolio overview.
- Watchlist overview.
- Instrument detail summary.
- Research run history.
- Lightweight agent chat.
- In-app notification inbox for completed runs and alerts.
- OS push notifications for completed runs and alerts in Phase 2.
- Read-only artifact viewing for reports and run cards.
- Biometric lock for sensitive portfolio data.
- Deep links into run details, instruments, and watchlists.
- File import for trade CSVs where platform rules allow.

Mobile should not launch heavyweight local backtests. It should submit jobs to the backend and show progress/results.

## 5. Tauri Mobile Requirements

Tauri mobile builds must support:

- iOS and Android builds from the same Tauri project.
- Responsive webview layouts with touch-first controls.
- Platform-specific capability declarations for each window/webview.
- Official Tauri plugins for biometric, notifications, deep linking, file system, HTTP, SQL/store, and websocket where available.
- Custom mobile plugins only after an official plugin is unavailable or insufficient.
- App Store and Google Play signing/release pipelines.
- Device smoke tests for cold start, navigation, auth, in-app notification inbox, run streaming, and artifact viewing.
- Push notification receipt smoke tests before the Phase 2 push-notification release.
- A proof-of-capability milestone before MVP UI freeze.

## 6. Cross-Platform UX Requirements

- Same portfolios, watchlists, strategies, and run history across devices.
- All agent outputs must be responsive and readable on mobile.
- Charts must degrade gracefully on small screens.
- Risk warnings must never be hidden behind hover-only UI.
- Mobile summaries should be shorter, but full artifacts must remain accessible.

## 7. Offline And Sync

MVP:

- Read cached portfolios, watchlists, and latest run summaries offline.
- Queue note edits locally and sync when online.

Post-MVP:

- Offline local research notes.
- Background market refresh.
- Conflict resolution for simultaneous edits.

## 8. Acceptance Criteria

- User starts a research run on macOS and later reads the completed run on mobile.
- User edits a watchlist note on mobile and sees it on macOS after sync.
- macOS can render a full backtest report while mobile renders a compact summary with the full report link.
- The same Tauri codebase can produce a macOS app, an iOS build, and an Android build.
- Before beta, the team verifies Tauri mobile support for biometric lock, deep links, file import, and run streaming on real devices.
- Before the Phase 2 push-notification release, the team verifies Tauri mobile push notification support on real iOS and Android devices.
