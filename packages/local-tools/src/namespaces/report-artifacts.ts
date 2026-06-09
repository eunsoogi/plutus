import { PAST_PERFORMANCE_CAVEAT } from "@plutus/backtest";
import type { NamespaceHandler } from "./common";
import { contentHash, writeDurableText } from "./common";
import type { SourceRef } from "../schemas/envelope";

export type ReportFormat = "markdown" | "html" | "pdf";
type ReportLanguage = "en" | "ko";

const REPORT_TIMESTAMP = new Date(0).toISOString();
const REPORT_COPY: Record<
  ReportLanguage,
  {
    readonly title: string;
    readonly caveatHeading: string;
    readonly caveat: string;
  }
> = {
  en: {
    title: "Plutus Research Report",
    caveatHeading: "Caveat",
    caveat: PAST_PERFORMANCE_CAVEAT,
  },
  ko: {
    title: "Plutus 리서치 보고서",
    caveatHeading: "주의사항",
    caveat: "과거 성과는 미래 결과를 보장하지 않습니다.",
  },
};

export function reportLocaleValue(locale: string | undefined) {
  return locale?.trim() ? locale : "en-US";
}

export function renderReportContent(input: {
  readonly sections: readonly {
    readonly title: string;
    readonly body: string;
  }[];
  readonly format: ReportFormat;
  readonly locale: string;
}) {
  const copy = REPORT_COPY[reportLanguage(input.locale)];
  const markdown = [
    `# ${copy.title}`,
    "",
    ...input.sections.flatMap((section) => [
      `## ${section.title}`,
      "",
      section.body,
      "",
    ]),
    `## ${copy.caveatHeading}`,
    "",
    copy.caveat,
    "",
  ].join("\n");
  if (input.format === "html") {
    return markdown
      .split("\n")
      .map((line) =>
        line.startsWith("# ")
          ? `<h1>${line.slice(2)}</h1>`
          : line.startsWith("## ")
            ? `<h2>${line.slice(3)}</h2>`
            : line
              ? `<p>${line}</p>`
              : "",
      )
      .join("\n");
  }
  return markdown;
}

export function reportMimeType(format: ReportFormat) {
  switch (format) {
    case "html":
      return "text/html";
    case "pdf":
      return "application/pdf";
    case "markdown":
      return "text/markdown";
  }
}

export function artifactFor(input: {
  readonly runtime: Parameters<NamespaceHandler>[0]["runtime"];
  readonly context: Parameters<NamespaceHandler>[0]["context"];
  readonly runId: string;
  readonly kind: string;
  readonly content: string;
  readonly mimeType: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly locale?: string;
}) {
  const hash = contentHash(input.content);
  const id = `artifact_${input.kind}_${hash.slice(7, 19)}`;
  const path = writeDurableText(
    input.runtime,
    input.context,
    ["artifacts", `${id}.${artifactExtension(input.mimeType)}`],
    input.content,
  );
  return {
    id,
    runId: input.runId,
    kind: input.kind,
    content: input.content,
    contentHash: hash,
    path,
    mimeType: input.mimeType,
    sourceRefs: input.sourceRefs,
    ...(input.locale ? { locale: input.locale } : {}),
    caveats: [REPORT_COPY[reportLanguage(input.locale)].caveat],
    createdAt: REPORT_TIMESTAMP,
  };
}

export function normalizeSourceRefs(
  refs: readonly Partial<SourceRef>[] | undefined,
): SourceRef[] {
  return (
    refs?.length ? refs : [{ id: "local-run", provider: "plutus_reports" }]
  ).map((ref) => ({
    id: ref.id ?? "local-run",
    provider: ref.provider ?? "plutus_reports",
    ...(ref.title ? { title: ref.title } : {}),
    ...(ref.url ? { url: ref.url } : {}),
    ...(ref.asOf ? { asOf: ref.asOf } : {}),
    retrievedAt: ref.retrievedAt ?? REPORT_TIMESTAMP,
  }));
}

function reportLanguage(locale: string | undefined): ReportLanguage {
  return locale?.toLocaleLowerCase().startsWith("ko") ? "ko" : "en";
}

function artifactExtension(mimeType: string) {
  if (mimeType === "text/markdown") return "md";
  if (mimeType === "text/html") return "html";
  if (mimeType === "application/json") return "json";
  return "artifact";
}
