import type { SourceRef, WikiPageCategory } from "./schemas";

export interface WikiPage {
  id: string;
  profileId: string;
  slug: string;
  category: WikiPageCategory;
  title: string;
  summary: string;
  status: "active" | "archived";
  currentRevisionId: string;
  storageKey: string;
  tags: string[];
  sourceRefs: SourceRef[];
  memoryRefs: string[];
  freshness: "current" | "needs_review" | "stale" | "contradicted";
  confidence: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface WikiRevision {
  id: string;
  wikiPageId: string;
  revisionNumber: number;
  storageKey: string;
  contentHash: string;
  revisionNote: string;
  sourceRefs: SourceRef[];
  contradictionRefs: string[];
  createdBy: "agent:llm_wiki_curator" | "system" | "user";
  auditRef: string;
  createdAt: string;
}

export interface WikiActivity {
  id: string;
  pageId: string;
  revisionId?: string;
  eventType:
    | "created"
    | "updated"
    | "merged"
    | "archived"
    | "reverted"
    | "cross_linked";
  actor: string;
  sourceRefs: SourceRef[];
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WikiPageBundle {
  page: WikiPage;
  revisions: WikiRevision[];
  markdown: string;
}

export interface WikiRepositoryState {
  pages: WikiPage[];
  revisions: Array<[string, WikiRevision[]]>;
  activity: WikiActivity[];
  links: Array<{
    fromPageId: string;
    toPageId: string;
    linkType: string;
    reason: string;
  }>;
}
