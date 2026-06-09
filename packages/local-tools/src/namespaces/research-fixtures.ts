import type { SourceRef } from "../schemas/envelope";

export type ResearchSourceKind = "web" | "url" | "document" | "filing" | "news";

export interface ResearchSource {
  sourceRef: SourceRef;
  kind: ResearchSourceKind;
  title: string;
  summary: string;
  url?: string;
  documentId?: string;
  instrumentId?: string;
  filingType?: string;
  publishedAt: string;
  keywords: string[];
}

export const RESEARCH_SOURCES: ResearchSource[] = [
  {
    sourceRef: sourceRef(
      "research_web_btc_nvda_concentration",
      "fixture-web",
      "BTC/NVDA concentration review fixture",
      "https://research.local/btc-nvda-concentration",
    ),
    kind: "web",
    title: "BTC/NVDA concentration review fixture",
    summary:
      "BTC and NVDA jointly dominate the Core fixture portfolio risk budget; review concentration and volatility before adding exposure.",
    url: "https://research.local/btc-nvda-concentration",
    publishedAt: "2026-05-17T00:00:00.000Z",
    keywords: ["btc", "nvda", "concentration", "risk", "volatility"],
  },
  {
    sourceRef: sourceRef(
      "research_url_btc_nvda_risk",
      "fixture-reader",
      "Sanitized BTC/NVDA risk note",
      "https://research.local/btc-nvda-risk",
    ),
    kind: "url",
    title: "Sanitized BTC/NVDA risk note",
    summary:
      "Sanitized note: stale BTC quotes and correlated growth exposure reduce confidence in short-term portfolio action.",
    url: "https://research.local/btc-nvda-risk",
    publishedAt: "2026-05-17T00:00:00.000Z",
    keywords: ["btc", "nvda", "risk", "stale", "quote"],
  },
  {
    sourceRef: sourceRef(
      "research_doc_btc_nvda_risk",
      "fixture-document",
      "Fixture BTC/NVDA risk memo",
    ),
    kind: "document",
    title: "Fixture BTC/NVDA risk memo",
    summary:
      "Internal deterministic memo linking BTC drawdown, NVDA valuation risk, and liquidity assumptions for the Core portfolio.",
    documentId: "fixture-doc-btc-nvda-risk",
    publishedAt: "2026-05-17T00:00:00.000Z",
    keywords: ["btc", "nvda", "document", "memo", "drawdown"],
  },
  {
    sourceRef: sourceRef(
      "research_filing_nvda_10q",
      "fixture-sec",
      "NVIDIA fixture 10-Q risk factors",
      "https://research.local/filings/nvda-10q",
    ),
    kind: "filing",
    title: "NVIDIA fixture 10-Q risk factors",
    summary:
      "Fixture filing excerpt highlights demand cyclicality, supply constraints, and valuation-sensitive semiconductor exposure.",
    url: "https://research.local/filings/nvda-10q",
    instrumentId: "018f3f5d-0000-7000-8000-000000000102",
    filingType: "10-Q",
    publishedAt: "2026-05-10T00:00:00.000Z",
    keywords: ["nvda", "10-q", "filing", "semiconductor", "risk"],
  },
  {
    sourceRef: sourceRef(
      "research_news_btc_liquidity",
      "fixture-news",
      "BTC liquidity fixture headline",
      "https://research.local/news/btc-liquidity",
    ),
    kind: "news",
    title: "BTC liquidity fixture headline",
    summary:
      "Fixture news item flags thinner weekend liquidity and stale quote caveats for BTC portfolio sizing.",
    url: "https://research.local/news/btc-liquidity",
    instrumentId: "018f3f5d-0000-7000-8000-000000000103",
    publishedAt: "2026-05-16T12:00:00.000Z",
    keywords: ["btc", "news", "liquidity", "stale", "sizing"],
  },
  {
    sourceRef: sourceRef(
      "research_news_nvda_valuation",
      "fixture-news",
      "NVDA valuation fixture headline",
      "https://research.local/news/nvda-valuation",
    ),
    kind: "news",
    title: "NVDA valuation fixture headline",
    summary:
      "Fixture news item notes strong AI infrastructure demand alongside valuation and concentration risk.",
    url: "https://research.local/news/nvda-valuation",
    instrumentId: "018f3f5d-0000-7000-8000-000000000102",
    publishedAt: "2026-05-16T13:00:00.000Z",
    keywords: ["nvda", "news", "valuation", "concentration", "ai"],
  },
];

function sourceRef(
  id: string,
  provider: string,
  title: string,
  url?: string,
): SourceRef {
  return {
    id,
    provider,
    title,
    url,
    asOf: "2026-05-17T00:00:00.000Z",
    retrievedAt: new Date(0).toISOString(),
  };
}
