import type { NamespaceHandler } from "./common";
import { warning } from "./common";
import type {
  LocalToolResponse,
  LocalToolWarning,
  SourceRef,
} from "../schemas/envelope";

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/i,
  /hide (all )?risk/i,
  /reveal (secrets|credentials|private keys)/i,
  /change (tool )?permissions/i,
];

type ResearchSourceKind = "web" | "url" | "document" | "filing" | "news";

interface ResearchSource {
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

const RESEARCH_SOURCES: ResearchSource[] = [
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

export function detectPromptInjection(value: unknown): boolean {
  const text = JSON.stringify(value ?? "");
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export const handleResearch: NamespaceHandler = ({ call, auditRef }) => {
  const warnings = detectPromptInjection(call.input)
    ? [promptInjectionWarning()]
    : [];

  switch (call.tool) {
    case "web_search": {
      const results = searchSources(call.input, "web");
      return researchOk(
        auditRef,
        {
          query: stringInput(call.input, "query") ?? "",
          results: results.map(searchResult),
          promptInjectionWarning: warnings.length > 0,
        },
        results.map((source) => source.sourceRef),
        [
          ...warnings,
          ...(results.length === 0 ? [emptyWarning("research search")] : []),
        ],
      );
    }
    case "read_url": {
      const source = sourceByUrl(stringInput(call.input, "url"));
      return researchOk(
        auditRef,
        {
          source: source ? readSource(source, true) : null,
        },
        source ? [source.sourceRef] : [],
        [
          ...warnings,
          ...(source
            ? []
            : [unsupportedWarning("url", stringInput(call.input, "url"))]),
        ],
      );
    }
    case "read_document": {
      const source = sourceByDocumentId(stringInput(call.input, "documentId"));
      return researchOk(
        auditRef,
        {
          document: source
            ? {
                ...readSource(source, true),
                documentId: source.documentId,
              }
            : null,
        },
        source ? [source.sourceRef] : [],
        [
          ...warnings,
          ...(source
            ? []
            : [
                unsupportedWarning(
                  "document",
                  stringInput(call.input, "documentId"),
                ),
              ]),
        ],
      );
    }
    case "search_filings": {
      const filings = searchFilings(call.input);
      return researchOk(
        auditRef,
        { filings: filings.map(filingResult) },
        filings.map((source) => source.sourceRef),
        [
          ...warnings,
          ...(filings.length === 0 ? [emptyWarning("filing search")] : []),
        ],
      );
    }
    case "get_news": {
      const news = getNews(call.input);
      return researchOk(
        auditRef,
        { news: news.map(newsResult) },
        news.map((source) => source.sourceRef),
        [
          ...warnings,
          ...(news.length === 0 ? [emptyWarning("news search")] : []),
        ],
      );
    }
    case "summarize_sources": {
      const selected = selectedSources(call.input);
      return researchOk(
        auditRef,
        {
          purpose: stringInput(call.input, "purpose") ?? "source summary",
          summary:
            selected.length > 0
              ? `BTC/NVDA concentration summary: ${selected
                  .map((source) => source.summary)
                  .join(" ")}`
              : "No deterministic source fixtures matched the requested source references.",
          citedSourceRefIds: selected.map((source) => source.sourceRef.id),
          promptInjectionWarning: warnings.length > 0,
        },
        selected.map((source) => source.sourceRef),
        [
          ...warnings,
          ...(selected.length === 0 ? [emptyWarning("source summary")] : []),
        ],
      );
    }
    default:
      return researchOk(
        auditRef,
        undefined,
        [],
        [
          ...warnings,
          warning(
            "unsupported_research_tool",
            "blocking",
            `${call.tool} is not implemented by plutus_research fixtures.`,
          ),
        ],
      );
  }
};

function searchSources(input: unknown, kind: ResearchSourceKind) {
  const terms = (stringInput(input, "query") ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const limit = numberInput(input, "limit") ?? 5;
  return RESEARCH_SOURCES.filter((source) => source.kind === kind)
    .filter((source) =>
      terms.length === 0
        ? true
        : terms.some(
            (term) =>
              source.keywords.includes(term) ||
              source.title.toLowerCase().includes(term) ||
              source.summary.toLowerCase().includes(term),
          ),
    )
    .slice(0, limit);
}

function sourceByUrl(url: string | undefined) {
  return RESEARCH_SOURCES.find(
    (source) => source.kind === "url" && source.url === url,
  );
}

function sourceByDocumentId(documentId: string | undefined) {
  return RESEARCH_SOURCES.find(
    (source) => source.kind === "document" && source.documentId === documentId,
  );
}

function searchFilings(input: unknown) {
  const instrumentId = stringInput(input, "instrumentId");
  const filingTypes = arrayInput(input, "filingTypes").map((item) =>
    String(item).toUpperCase(),
  );
  return RESEARCH_SOURCES.filter((source) => source.kind === "filing").filter(
    (source) =>
      (!instrumentId || source.instrumentId === instrumentId) &&
      (filingTypes.length === 0 ||
        (source.filingType && filingTypes.includes(source.filingType))),
  );
}

function getNews(input: unknown) {
  const instrumentId = stringInput(input, "instrumentId");
  return RESEARCH_SOURCES.filter((source) => source.kind === "news").filter(
    (source) => !instrumentId || source.instrumentId === instrumentId,
  );
}

function selectedSources(input: unknown) {
  return sourceRefIds(input)
    .map((id) => RESEARCH_SOURCES.find((source) => source.sourceRef.id === id))
    .filter((source): source is ResearchSource => Boolean(source));
}

function sourceRefIds(input: unknown): string[] {
  const values = arrayInput(input, "sourceRefs");
  return values
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }
      if (value && typeof value === "object" && "id" in value) {
        return String((value as { id: unknown }).id);
      }
      if (value && typeof value === "object" && "sourceRefId" in value) {
        return String((value as { sourceRefId: unknown }).sourceRefId);
      }
      return undefined;
    })
    .filter((value): value is string => Boolean(value));
}

function searchResult(source: ResearchSource) {
  return {
    title: source.title,
    snippet: source.summary,
    url: source.url,
    publishedAt: source.publishedAt,
    sourceRefId: source.sourceRef.id,
  };
}

function readSource(source: ResearchSource, sanitized: boolean) {
  return {
    title: source.title,
    url: source.url,
    summary: source.summary,
    sanitized,
    sourceRefId: source.sourceRef.id,
    publishedAt: source.publishedAt,
  };
}

function filingResult(source: ResearchSource) {
  return {
    instrumentId: source.instrumentId,
    filingType: source.filingType,
    title: source.title,
    filedAt: source.publishedAt,
    summary: source.summary,
    sourceRefId: source.sourceRef.id,
  };
}

function newsResult(source: ResearchSource) {
  return {
    instrumentId: source.instrumentId,
    title: source.title,
    publishedAt: source.publishedAt,
    summary: source.summary,
    url: source.url,
    sourceRefId: source.sourceRef.id,
  };
}

function promptInjectionWarning(): LocalToolWarning {
  return warning(
    "prompt_injection_detected",
    "warning",
    "Untrusted source text attempted to override instructions, permissions, secrets, or risk disclosure.",
  );
}

function emptyWarning(subject: string): LocalToolWarning {
  return warning(
    "no_fixture_research_results",
    "info",
    `No deterministic ${subject} results matched the request.`,
  );
}

function unsupportedWarning(kind: string, value: string | undefined) {
  return warning(
    "unsupported_research_source",
    "blocking",
    `${kind} ${value ?? "(missing)"} is not available in deterministic research fixtures.`,
  );
}

function stringInput(input: unknown, field: string): string | undefined {
  if (!input || typeof input !== "object" || !(field in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

function numberInput(input: unknown, field: string): number | undefined {
  if (!input || typeof input !== "object" || !(field in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "number" ? value : undefined;
}

function arrayInput(input: unknown, field: string): unknown[] {
  if (!input || typeof input !== "object" || !(field in input)) {
    return [];
  }
  const value = (input as Record<string, unknown>)[field];
  return Array.isArray(value) ? value : [];
}

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

function researchOk(
  auditRef: string,
  data: unknown,
  sourceRefs: SourceRef[],
  warnings: LocalToolWarning[],
): LocalToolResponse {
  return {
    ok: true,
    data,
    sourceRefs,
    warnings,
    auditRef,
  };
}
