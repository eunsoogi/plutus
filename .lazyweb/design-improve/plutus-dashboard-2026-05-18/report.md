# Plutus Dashboard Design Improve - 2026-05-18

## Reference Direction
Plutus should read as a compact investment desk OS: Koyfin/TradingView/IBKR-style density, panelized market surfaces, and a Codex-style agent activity trail. The target user is not browsing a marketing site; they are inspecting positions, evidence, risk warnings, and local agent output repeatedly.

## Current Issues Found
- The previous UI used a simple light SaaS dashboard style with oversized empty areas and weak hierarchy.
- Portfolio, artifacts, run progress, and risk state had equal visual weight, so there was no clear research workflow.
- Financial data did not use a desk-like table/chart treatment, making the product feel generic rather than investment-specific.
- Empty local runtime state looked accidental instead of intentionally designed.

## Chosen Improvements
1. Dark professional workstation shell with restrained cyan/green accents and amber/red risk tones.
2. Persistent left navigation rail with compact controls.
3. Dashboard grid reorganized into portfolio/watchlist, central artifact canvas, agent activity, and run progress zones.
4. Portfolio summary upgraded into a dense financial table with tabular values and thesis column.
5. Chart treatment changed to a grid-backed market canvas with layered line/area styling.
6. Empty artifact state now appears as a deliberate workspace placeholder instead of a blank card.
7. Mobile remote surfaces inherit the same professional dark control language.

## References Used
- TradingView Desktop: multi-monitor trading workspace and persistent chart/watchlist layouts. https://www.tradingview.com/desktop/
- IBKR Mosaic: professional multi-pane trading layout. https://www.ibkrguides.com/traderworkstation/mosaic-layout.htm
- Koyfin Features: custom dashboards, watchlists, graphing, and analysis density. https://www.koyfin.com/features/
- Yahoo Finance markets tables: practical scannable market table conventions. https://finance.yahoo.com/markets/stocks/most-active/
- OpenAI Codex overview: background agent runs and reviewable outputs as an activity model. https://platform.openai.com/docs/codex/overview

## Implemented Files
- packages/ui/src/plutus-app.tsx
- apps/web-preview/src/styles.css

## Verification Targets
- Desktop dashboard: http://127.0.0.1:4173/dashboard?runtime=local
- Mobile remote dashboard: http://127.0.0.1:4173/remote/dashboard?remote=connected
