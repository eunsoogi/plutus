import type {
  LocalToolResponse,
  LocalToolWarning,
  SourceRef,
} from "../schemas/envelope";
import { warning } from "./common";
import {
  RESEARCH_SOURCES,
  type ResearchSource,
  type ResearchSourceKind,
} from "./research-fixtures";

export function searchSources(input: unknown, kind: ResearchSourceKind) {
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

export function sourceByUrl(url: string | undefined) {
  return RESEARCH_SOURCES.find(
    (source) => source.kind === "url" && source.url === url,
  );
}

export function sourceByDocumentId(documentId: string | undefined) {
  return RESEARCH_SOURCES.find(
    (source) => source.kind === "document" && source.documentId === documentId,
  );
}

export function searchFilings(input: unknown) {
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

export function getNews(input: unknown) {
  const instrumentId = stringInput(input, "instrumentId");
  return RESEARCH_SOURCES.filter((source) => source.kind === "news").filter(
    (source) => !instrumentId || source.instrumentId === instrumentId,
  );
}

export function selectedSources(input: unknown) {
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

export function searchResult(source: ResearchSource) {
  return {
    title: source.title,
    snippet: source.summary,
    url: source.url,
    publishedAt: source.publishedAt,
    sourceRefId: source.sourceRef.id,
  };
}

export function readSource(source: ResearchSource, sanitized: boolean) {
  return {
    title: source.title,
    url: source.url,
    summary: source.summary,
    sanitized,
    sourceRefId: source.sourceRef.id,
    publishedAt: source.publishedAt,
  };
}

export function filingResult(source: ResearchSource) {
  return {
    instrumentId: source.instrumentId,
    filingType: source.filingType,
    title: source.title,
    filedAt: source.publishedAt,
    summary: source.summary,
    sourceRefId: source.sourceRef.id,
  };
}

export function newsResult(source: ResearchSource) {
  return {
    instrumentId: source.instrumentId,
    title: source.title,
    publishedAt: source.publishedAt,
    summary: source.summary,
    url: source.url,
    sourceRefId: source.sourceRef.id,
  };
}

export function promptInjectionWarning(): LocalToolWarning {
  return warning(
    "prompt_injection_detected",
    "warning",
    "Untrusted source text attempted to override instructions, permissions, secrets, or risk disclosure.",
  );
}

export function emptyWarning(subject: string): LocalToolWarning {
  return warning(
    "no_fixture_research_results",
    "info",
    `No deterministic ${subject} results matched the request.`,
  );
}

export function unsupportedWarning(kind: string, value: string | undefined) {
  return warning(
    "unsupported_research_source",
    "blocking",
    `${kind} ${value ?? "(missing)"} is not available in deterministic research fixtures.`,
  );
}

export function stringInput(input: unknown, field: string): string | undefined {
  if (!input || typeof input !== "object" || !(field in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

export function numberInput(input: unknown, field: string): number | undefined {
  if (!input || typeof input !== "object" || !(field in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "number" ? value : undefined;
}

export function arrayInput(input: unknown, field: string): unknown[] {
  if (!input || typeof input !== "object" || !(field in input)) {
    return [];
  }
  const value = (input as Record<string, unknown>)[field];
  return Array.isArray(value) ? value : [];
}

export function researchOk(
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
