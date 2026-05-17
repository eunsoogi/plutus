import {
  ContradictionChecker,
  WikiRepository,
  type SourceRef as WikiSourceRef,
  type WikiPageCategory,
} from "@plutus/wiki";

import type { InMemoryToolRuntime } from "../audit/in-memory-audit";
import type { LocalToolRunContext } from "../context";
import type { NamespaceHandler } from "./common";
import { ok, storagePath, warning } from "./common";

interface WikiRuntime {
  repo: WikiRepository;
  contradictions: ContradictionChecker;
}

export const handleWiki: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  const wiki = wikiRuntime(runtime, context);

  switch (call.tool) {
    case "search_wiki": {
      const input = call.input as { query?: string };
      return ok(auditRef, "plutus_wiki", {
        pages: wiki.repo.search(input.query ?? ""),
      });
    }
    case "get_wiki_page": {
      const input = call.input as { pageId?: string };
      return ok(auditRef, "plutus_wiki", wiki.repo.getPage(input.pageId ?? ""));
    }
    case "create_wiki_page": {
      const input = wikiPageInput(call.input, context);
      const page = wiki.repo.createPage({
        profileId: context.profileId,
        category: input.category,
        title: input.title,
        slug: input.slug,
        markdown: input.markdown,
        summary: input.summary,
        tags: input.tags,
        sourceRefs: input.sourceRefs,
        memoryRefs: input.memoryRefs,
        revisionNote: input.revisionNote,
        createdBy: "agent:llm_wiki_curator",
      });
      return ok(auditRef, "plutus_wiki", wiki.repo.getPage(page.id));
    }
    case "update_wiki_page": {
      const input = call.input as {
        pageId?: string;
        markdown?: string;
        updatedMarkdown?: string;
        summary?: string;
        sourceRefs?: Array<Partial<WikiSourceRef>>;
        revisionNote?: string;
        contradictionRefs?: string[];
      };
      return ok(
        auditRef,
        "plutus_wiki",
        wiki.repo.updatePage(input.pageId ?? "", {
          markdown: input.updatedMarkdown ?? input.markdown ?? "",
          summary: input.summary,
          sourceRefs: normalizeSourceRefs(input.sourceRefs, context),
          revisionNote: input.revisionNote ?? "Update wiki page.",
          createdBy: "agent:llm_wiki_curator",
          contradictionRefs: input.contradictionRefs,
        }),
      );
    }
    case "merge_wiki_pages": {
      const input = call.input as {
        sourcePageIds?: string[];
        targetTitle?: string;
        mergedMarkdown?: string;
        sourceRefs?: Array<Partial<WikiSourceRef>>;
        revisionNote?: string;
      };
      return ok(auditRef, "plutus_wiki", {
        page: wiki.repo.mergePages({
          sourcePageIds: input.sourcePageIds ?? [],
          targetTitle: input.targetTitle ?? "Merged Wiki Page",
          mergedMarkdown: input.mergedMarkdown ?? "",
          sourceRefs: normalizeSourceRefs(input.sourceRefs, context),
          revisionNote: input.revisionNote ?? "Merge wiki pages.",
          actor: "agent:llm_wiki_curator",
        }),
      });
    }
    case "archive_wiki_page": {
      const input = call.input as { pageId?: string; reason?: string };
      return ok(auditRef, "plutus_wiki", {
        page: wiki.repo.archivePage(
          input.pageId ?? "",
          input.reason ?? "Archived by wiki curator.",
          "agent:llm_wiki_curator",
        ),
      });
    }
    case "revert_wiki_revision": {
      const input = call.input as {
        pageId?: string;
        revisionId?: string;
        reason?: string;
      };
      return ok(
        auditRef,
        "plutus_wiki",
        wiki.repo.revertRevision(
          input.pageId ?? "",
          input.revisionId ?? "",
          input.reason ?? "Reverted by wiki curator.",
          "agent:llm_wiki_curator",
        ),
      );
    }
    case "find_wiki_contradictions": {
      const input = call.input as { claims?: string[] };
      return ok(auditRef, "plutus_wiki", {
        contradictions: wiki.contradictions.findContradictions(
          input.claims ?? [],
        ),
      });
    }
    default:
      return ok(auditRef, "plutus_wiki", undefined, [
        warning(
          "unsupported_wiki_tool",
          "blocking",
          `${call.tool} is not implemented by plutus_wiki.`,
        ),
      ]);
  }
};

function wikiRuntime(
  runtime: InMemoryToolRuntime,
  context: LocalToolRunContext,
): WikiRuntime {
  const key = `wiki_runtime_${context.profileId}`;
  const existing = runtime.records.get(key);
  if (isWikiRuntime(existing)) {
    return existing;
  }
  const repo = new WikiRepository({
    rootDir: storagePath(runtime, context, "wiki", context.profileId),
  });
  const created = { repo, contradictions: new ContradictionChecker(repo) };
  runtime.records.set(key, created);
  return created;
}

function wikiPageInput(inputValue: unknown, context: LocalToolRunContext) {
  const input = inputValue as {
    category?: WikiPageCategory;
    title?: string;
    slug?: string;
    markdown?: string;
    summary?: string;
    tags?: string[];
    sourceRefs?: Array<Partial<WikiSourceRef>>;
    memoryRefs?: string[];
    revisionNote?: string;
  };
  const title = input.title ?? "Untitled Wiki Page";
  return {
    category: input.category ?? "workflow",
    title,
    slug: input.slug ?? slugify(title),
    markdown: input.markdown ?? "",
    summary: input.summary ?? title,
    tags: input.tags ?? [],
    sourceRefs: normalizeSourceRefs(input.sourceRefs, context),
    memoryRefs: input.memoryRefs ?? [],
    revisionNote: input.revisionNote ?? "Create wiki page.",
  };
}

function normalizeSourceRefs(
  refs: Array<Partial<WikiSourceRef>> | undefined,
  context: LocalToolRunContext,
): WikiSourceRef[] {
  const normalized = refs?.length
    ? refs
    : [{ type: "run", id: context.runId, title: "Current run" }];
  return normalized.map((ref) => ({
    type: ref.type ?? "run",
    id: ref.id ?? context.runId,
    title: ref.title,
    url: ref.url,
  }));
}

function isWikiRuntime(value: unknown): value is WikiRuntime {
  return Boolean(
    value &&
    typeof value === "object" &&
    "repo" in value &&
    "contradictions" in value,
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
