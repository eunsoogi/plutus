import type { NamespaceHandler } from "./common";
import { allowFixtureTools, warning } from "./common";
import {
  emptyWarning,
  filingResult,
  getNews,
  newsResult,
  promptInjectionWarning,
  readSource,
  researchOk,
  searchFilings,
  searchResult,
  searchSources,
  selectedSources,
  sourceByDocumentId,
  sourceByUrl,
  stringInput,
  unsupportedWarning,
} from "./research-selectors";

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/i,
  /hide (all )?risk/i,
  /reveal (secrets|credentials|private keys)/i,
  /change (tool )?permissions/i,
];

export function detectPromptInjection(value: unknown): boolean {
  const text = JSON.stringify(value ?? "");
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export const handleResearch: NamespaceHandler = ({ call, auditRef }) => {
  const warnings = detectPromptInjection(call.input)
    ? [promptInjectionWarning()]
    : [];
  if (!allowFixtureTools()) {
    return researchOk(
      auditRef,
      undefined,
      [],
      [
        ...warnings,
        warning(
          "research_provider_not_configured",
          "blocking",
          "Research providers are not configured for local runtime; deterministic fixtures require PLUTUS_ALLOW_FIXTURE_TOOLS=1.",
        ),
      ],
    );
  }

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
