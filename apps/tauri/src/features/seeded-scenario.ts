import type { PlutusScenario } from "@plutus/ui";

export const seededScenario: PlutusScenario = {
  portfolio: {
    id: "portfolio-core",
    name: "Core",
    value: 184250,
    positions: [
      {
        symbol: "BTC",
        name: "Bitcoin",
        value: 68200,
        allocation: "37.0%",
        thesis: "Digital reserve exposure with high volatility.",
      },
      {
        symbol: "NVDA",
        name: "NVIDIA",
        value: 54300,
        allocation: "29.5%",
        thesis: "AI infrastructure leader with concentration risk.",
      },
      {
        symbol: "USDC",
        name: "USD Cash",
        value: 61750,
        allocation: "33.5%",
        thesis: "Dry powder and risk buffer.",
      },
    ],
  },
  watchlist: {
    id: "watchlist-default",
    name: "Default Watchlist",
    items: ["BTC", "NVDA", "ETH", "SPY", "QQQ"],
  },
  instrument: {
    id: "instrument-btc",
    symbol: "BTC",
    name: "Bitcoin",
    summary:
      "High-volatility digital reserve exposure tracked against NVDA correlation.",
  },
  run: {
    id: "run-btc-nvda",
    title: "BTC/NVDA Portfolio Review",
    status: "Risk review complete",
    category: "risk_warning",
    artifacts: [
      {
        id: "artifact-risk-report",
        name: "BTC NVDA risk report",
        type: "report",
      },
      {
        id: "artifact-exposure-chart",
        name: "Exposure chart JSON",
        type: "chart",
      },
      {
        id: "artifact-strategy-spec",
        name: "Risk trim strategy spec",
        type: "strategy",
      },
    ],
  },
  memory: {
    id: "memory-btc-nvda-concentration",
    summary: "BTC and NVDA concentration needs periodic review.",
    activity: "Captured",
  },
  wiki: {
    id: "wiki-btc-nvda-concentration",
    title: "BTC/NVDA Concentration Lesson",
    revision: "Revision 3 added stale quote and liquidity checks.",
    sourceRef: "run-btc-nvda / artifact-risk-report",
  },
  remoteDevice: {
    name: "Eunsoo iPhone",
    pairingCode: "418204",
  },
};
