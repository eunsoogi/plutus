import type { SourceRef, WikiPageCategory } from "./schemas";
import type {
  WikiPage,
  WikiRepositoryState,
  WikiRevision,
} from "./types";

export interface CreatePageInput {
  profileId: string;
  category: WikiPageCategory;
  title: string;
  slug: string;
  markdown: string;
  summary: string;
  tags: string[];
  sourceRefs: SourceRef[];
  memoryRefs: string[];
  revisionNote: string;
  createdBy: WikiRevision["createdBy"];
}

export interface UpdatePageInput {
  markdown: string;
  summary?: string;
  sourceRefs: SourceRef[];
  revisionNote: string;
  createdBy: WikiRevision["createdBy"];
  contradictionRefs?: string[];
}

export interface MergePagesInput {
  sourcePageIds: string[];
  targetTitle: string;
  mergedMarkdown: string;
  sourceRefs: SourceRef[];
  revisionNote: string;
  actor: WikiRevision["createdBy"];
}

export interface CreateRevisionInput {
  pageId: string;
  revisionNumber: number;
  markdown: string;
  sourceRefs: SourceRef[];
  revisionNote: string;
  createdBy: WikiRevision["createdBy"];
  contradictionRefs?: string[];
}

export function buildPage(input: {
  input: CreatePageInput;
  id: string;
  now: string;
  storageKey: string;
  revision: WikiRevision;
}): WikiPage {
  return {
    id: input.id,
    profileId: input.input.profileId,
    category: input.input.category,
    slug: input.input.slug,
    title: input.input.title,
    summary: input.input.summary,
    status: "active",
    currentRevisionId: input.revision.id,
    storageKey: input.storageKey,
    tags: [...input.input.tags],
    sourceRefs: [...input.input.sourceRefs],
    memoryRefs: [...input.input.memoryRefs],
    freshness: "current",
    confidence: "medium",
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function clonePage(page: WikiPage): WikiPage {
  return {
    ...page,
    tags: [...page.tags],
    sourceRefs: [...page.sourceRefs],
    memoryRefs: [...page.memoryRefs],
  };
}

export function hydrateRepositoryState(
  parsed: WikiRepositoryState,
  pages: Map<string, WikiPage>,
  revisionsByPage: Map<string, WikiRevision[]>,
): void {
  for (const page of parsed.pages ?? []) {
    pages.set(page.id, clonePage(page));
  }
  for (const [pageId, revisions] of parsed.revisions ?? []) {
    revisionsByPage.set(
      pageId,
      revisions.map((revision) => ({
        ...revision,
        sourceRefs: [...revision.sourceRefs],
        contradictionRefs: [...revision.contradictionRefs],
      })),
    );
  }
}
