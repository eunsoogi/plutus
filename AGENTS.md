# Agent Handoff Notes

- Work on `main`; after each completed task, make a conventional commit and push directly to `origin/main`.
- Recent trading integration work is in commit `351b928 feat: add trading venue credential setup`.
- Trading setup supports Kiwoom plus the full CCXT catalog from `packages/domain/src/trading/ccxt-exchanges.ts`.
- Provider setup UI must show real credential inputs. Do not regress to a credential-reference-only form.
- Never persist raw API keys/secrets in local UI state or config after save. Keep only `secure://plutus/providers/{providerId}/main` references.
- Default exchange health should be `not_configured`; do not show Upbit, Coinbase, Binance, or other CCXT venues as connected unless the user configured them.
- Keep major exchange labels Korean in the Korean locale, and keep Kiwoom visible as a first-class trading provider.
- Provider settings layout should avoid body-level scrolling at the default Tauri window size and should use search/select instead of pinned top exchange shortcuts.
- Useful verification commands:
  - `pnpm typecheck && pnpm test:unit && pnpm test:e2e:ui`
  - `pnpm --filter @plutus/tauri tauri build`
- If `pnpm add` fails because registry metadata lacks `time`, the repo uses a 14-day minimum release-age policy. Use command-scoped overrides only when necessary and pin the exact dependency version.
- Current Mac app artifact path: `apps/tauri/src-tauri/target/release/bundle/macos/Plutus.app`.
