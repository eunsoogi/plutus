import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";

export const SourceRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  title: z.string().optional(),
  url: z.string().url().optional(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const WikiPageCategorySchema = z.enum([
  "thesis",
  "strategy",
  "risk_lesson",
  "instrument",
  "workflow",
  "glossary",
]);

export type WikiPageCategory = z.infer<typeof WikiPageCategorySchema>;

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

interface WikiRepositoryState {
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

export class WikiRepository {
  readonly activity: WikiActivity[] = [];
  private readonly pages = new Map<string, WikiPage>();
  private readonly revisions = new Map<string, WikiRevision[]>();
  private readonly links: Array<{
    fromPageId: string;
    toPageId: string;
    linkType: string;
    reason: string;
  }> = [];

  constructor(private readonly options: { rootDir: string }) {
    mkdirSync(this.options.rootDir, { recursive: true });
    this.loadState();
  }

  createPage(input: {
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
  }): WikiPage {
    assertMarkdownHasSourceLinks(input.markdown, input.sourceRefs);
    const now = new Date().toISOString();
    const id = createId();
    const storageKey = currentStorageKey(input.category, input.slug);
    const revision = this.createRevision({
      pageId: id,
      revisionNumber: 1,
      markdown: input.markdown,
      sourceRefs: input.sourceRefs,
      revisionNote: input.revisionNote,
      createdBy: input.createdBy,
    });
    const page: WikiPage = {
      id,
      profileId: input.profileId,
      category: input.category,
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      status: "active",
      currentRevisionId: revision.id,
      storageKey,
      tags: [...input.tags],
      sourceRefs: [...input.sourceRefs],
      memoryRefs: [...input.memoryRefs],
      freshness: "current",
      confidence: "medium",
      createdAt: now,
      updatedAt: now,
    };
    this.pages.set(id, page);
    this.revisions.set(id, [revision]);
    this.write(storageKey, input.markdown);
    this.log({
      pageId: id,
      revisionId: revision.id,
      eventType: "created",
      actor: input.createdBy,
      sourceRefs: input.sourceRefs,
      payload: { revisionNote: input.revisionNote },
    });
    return { ...page };
  }

  updatePage(
    pageId: string,
    input: {
      markdown: string;
      summary?: string;
      sourceRefs: SourceRef[];
      revisionNote: string;
      createdBy: WikiRevision["createdBy"];
      contradictionRefs?: string[];
    },
  ): WikiPageBundle {
    assertMarkdownHasSourceLinks(input.markdown, input.sourceRefs);
    const page = this.requirePage(pageId);
    const pageRevisions = this.revisions.get(pageId) ?? [];
    const revision = this.createRevision({
      pageId,
      revisionNumber: pageRevisions.length + 1,
      markdown: input.markdown,
      sourceRefs: input.sourceRefs,
      revisionNote: input.revisionNote,
      createdBy: input.createdBy,
      contradictionRefs: input.contradictionRefs,
    });
    page.currentRevisionId = revision.id;
    page.summary = input.summary ?? page.summary;
    page.sourceRefs = mergeSourceRefs(page.sourceRefs, input.sourceRefs);
    page.updatedAt = new Date().toISOString();
    this.revisions.set(pageId, [...pageRevisions, revision]);
    this.write(page.storageKey, input.markdown);
    this.log({
      pageId,
      revisionId: revision.id,
      eventType: "updated",
      actor: input.createdBy,
      sourceRefs: input.sourceRefs,
      payload: { revisionNote: input.revisionNote },
    });
    return this.bundle(pageId);
  }

  archivePage(pageId: string, reason: string, actor: string): WikiPage {
    const page = this.requirePage(pageId);
    page.status = "archived";
    page.archivedAt = new Date().toISOString();
    page.updatedAt = page.archivedAt;
    this.log({
      pageId,
      eventType: "archived",
      actor,
      sourceRefs: page.sourceRefs,
      payload: { reason },
    });
    return { ...page };
  }

  revertRevision(
    pageId: string,
    revisionId: string,
    reason: string,
    actor: WikiRevision["createdBy"],
  ): WikiPageBundle {
    const page = this.requirePage(pageId);
    const revision = (this.revisions.get(pageId) ?? []).find(
      (candidate) => candidate.id === revisionId,
    );
    if (!revision) throw new Error(`Revision not found: ${revisionId}`);
    const markdown = this.read(revision.storageKey);
    const pageRevisions = this.revisions.get(pageId) ?? [];
    const revertedRevision = this.createRevision({
      pageId,
      revisionNumber: pageRevisions.length + 1,
      markdown,
      sourceRefs: revision.sourceRefs,
      revisionNote: `Revert: ${reason}`,
      createdBy: actor,
    });
    page.currentRevisionId = revertedRevision.id;
    page.sourceRefs = mergeSourceRefs(page.sourceRefs, revision.sourceRefs);
    page.updatedAt = new Date().toISOString();
    this.revisions.set(pageId, [...pageRevisions, revertedRevision]);
    this.write(page.storageKey, markdown);
    this.log({
      pageId,
      revisionId: revertedRevision.id,
      eventType: "reverted",
      actor,
      sourceRefs: revision.sourceRefs,
      payload: { reason, revertedTo: revisionId },
    });
    return this.bundle(pageId);
  }

  mergePages(input: {
    sourcePageIds: string[];
    targetTitle: string;
    mergedMarkdown: string;
    sourceRefs: SourceRef[];
    revisionNote: string;
    actor: WikiRevision["createdBy"];
  }): WikiPage {
    const [firstSource] = input.sourcePageIds.map((id) => this.requirePage(id));
    if (!firstSource) throw new Error("At least one source page is required.");
    const target = this.createPage({
      profileId: firstSource.profileId,
      category: firstSource.category,
      title: input.targetTitle,
      slug: slugify(input.targetTitle),
      markdown: input.mergedMarkdown,
      summary: input.targetTitle,
      tags: unique(
        input.sourcePageIds.flatMap((id) => this.requirePage(id).tags),
      ),
      sourceRefs: input.sourceRefs,
      memoryRefs: unique(
        input.sourcePageIds.flatMap((id) => this.requirePage(id).memoryRefs),
      ),
      revisionNote: input.revisionNote,
      createdBy: input.actor,
    });
    for (const sourceId of input.sourcePageIds) {
      this.archivePage(sourceId, `Merged into ${target.id}`, input.actor);
    }
    this.log({
      pageId: target.id,
      eventType: "merged",
      actor: input.actor,
      sourceRefs: input.sourceRefs,
      payload: { sourcePageIds: input.sourcePageIds },
    });
    return target;
  }

  addLink(
    fromPageId: string,
    toPageId: string,
    linkType: string,
    reason: string,
    actor: string,
  ): void {
    this.requirePage(fromPageId);
    this.requirePage(toPageId);
    this.links.push({ fromPageId, toPageId, linkType, reason });
    this.log({
      pageId: fromPageId,
      eventType: "cross_linked",
      actor,
      sourceRefs: [],
      payload: { toPageId, linkType, reason },
    });
  }

  getPage(pageId: string): WikiPageBundle | undefined {
    return this.pages.has(pageId) ? this.bundle(pageId) : undefined;
  }

  listPages(): WikiPage[] {
    return [...this.pages.values()].map((page) => ({ ...page }));
  }

  search(query: string): WikiPage[] {
    const needle = query.toLowerCase();
    return [...this.pages.values()]
      .filter((page) => page.status === "active")
      .filter((page) =>
        `${page.title} ${page.summary} ${page.tags.join(" ")}`
          .toLowerCase()
          .includes(needle),
      )
      .map((page) => ({ ...page }));
  }

  private bundle(pageId: string): WikiPageBundle {
    const page = this.requirePage(pageId);
    const revisions = this.revisions.get(pageId) ?? [];
    return {
      page: {
        ...page,
        tags: [...page.tags],
        sourceRefs: [...page.sourceRefs],
        memoryRefs: [...page.memoryRefs],
      },
      revisions: revisions.map((revision) => ({
        ...revision,
        sourceRefs: [...revision.sourceRefs],
      })),
      markdown: this.read(page.storageKey),
    };
  }

  private requirePage(pageId: string): WikiPage {
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`Wiki page not found: ${pageId}`);
    return page;
  }

  private createRevision(input: {
    pageId: string;
    revisionNumber: number;
    markdown: string;
    sourceRefs: SourceRef[];
    revisionNote: string;
    createdBy: WikiRevision["createdBy"];
    contradictionRefs?: string[];
  }): WikiRevision {
    const hash = sha256(input.markdown);
    const revision: WikiRevision = {
      id: createId(),
      wikiPageId: input.pageId,
      revisionNumber: input.revisionNumber,
      storageKey: join("revisions", `${hash}.md`),
      contentHash: hash,
      revisionNote: input.revisionNote,
      sourceRefs: [...input.sourceRefs],
      contradictionRefs: input.contradictionRefs ?? [],
      createdBy: input.createdBy,
      auditRef: `audit:${input.pageId}:${input.revisionNumber}`,
      createdAt: new Date().toISOString(),
    };
    this.write(revision.storageKey, input.markdown);
    return revision;
  }

  private write(storageKey: string, markdown: string): void {
    const path = join(this.options.rootDir, storageKey);
    mkdirSync(dirname(path), { recursive: true });
    atomicWrite(path, markdown);
  }

  private read(storageKey: string): string {
    return readFileSync(join(this.options.rootDir, storageKey), "utf8");
  }

  private log(input: Omit<WikiActivity, "id" | "createdAt">): void {
    this.activity.push({
      ...input,
      id: createId(),
      createdAt: new Date().toISOString(),
    });
    this.saveState();
  }

  private saveState(): void {
    const state: WikiRepositoryState = {
      pages: [...this.pages.values()],
      revisions: [...this.revisions.entries()],
      activity: this.activity,
      links: this.links,
    };
    atomicWrite(
      join(this.options.rootDir, "wiki-index.json"),
      `${JSON.stringify(state, null, 2)}\n`,
    );
  }

  private loadState(): void {
    try {
      const parsed = JSON.parse(
        readFileSync(join(this.options.rootDir, "wiki-index.json"), "utf8"),
      ) as WikiRepositoryState;
      for (const page of parsed.pages ?? []) {
        this.pages.set(page.id, {
          ...page,
          tags: [...page.tags],
          sourceRefs: [...page.sourceRefs],
          memoryRefs: [...page.memoryRefs],
        });
      }
      for (const [pageId, revisions] of parsed.revisions ?? []) {
        this.revisions.set(
          pageId,
          revisions.map((revision) => ({
            ...revision,
            sourceRefs: [...revision.sourceRefs],
            contradictionRefs: [...revision.contradictionRefs],
          })),
        );
      }
      this.activity.push(...(parsed.activity ?? []));
      this.links.push(...(parsed.links ?? []));
    } catch {
      return;
    }
  }
}

export type WikiMaintenancePlan = z.infer<typeof WikiMaintenancePlanSchema>;

export const WikiMaintenancePlanSchema = z.object({
  runId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  actions: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("create"),
        category: WikiPageCategorySchema,
        title: z.string(),
        slug: z.string(),
        markdown: z.string(),
        summary: z.string(),
        tags: z.array(z.string()),
        sourceRefs: z.array(SourceRefSchema),
        revisionNote: z.string(),
      }),
      z.object({
        type: z.literal("update"),
        pageId: z.string().uuid(),
        patch: z.string(),
        updatedMarkdown: z.string(),
        sourceRefs: z.array(SourceRefSchema),
        revisionNote: z.string(),
      }),
      z.object({
        type: z.literal("merge"),
        sourcePageIds: z.array(z.string().uuid()),
        targetTitle: z.string(),
        mergedMarkdown: z.string(),
        sourceRefs: z.array(SourceRefSchema),
        revisionNote: z.string(),
      }),
      z.object({
        type: z.literal("archive"),
        pageId: z.string().uuid(),
        reason: z.string(),
        sourceRefs: z.array(SourceRefSchema),
      }),
      z.object({
        type: z.literal("cross_link"),
        fromPageId: z.string().uuid(),
        toPageId: z.string().uuid(),
        linkType: z.enum([
          "supports",
          "contradicts",
          "updates",
          "related",
          "supersedes",
        ]),
        reason: z.string(),
      }),
    ]),
  ),
});

export class WikiCuratorService {
  constructor(private readonly repo: WikiRepository) {}

  maintain(plan: WikiMaintenancePlan): {
    pages: WikiPage[];
    memoryPointers: Array<{
      kind: "wiki_pointer";
      summary: string;
      semanticText: string;
      sourceRefs: SourceRef[];
    }>;
  } {
    const parsed = WikiMaintenancePlanSchema.parse(plan);
    const pages: WikiPage[] = [];
    for (const action of parsed.actions) {
      if (action.type === "create") {
        pages.push(
          this.repo.createPage({
            profileId: parsed.profileId ?? "default",
            category: action.category,
            title: action.title,
            slug: action.slug,
            markdown: action.markdown,
            summary: action.summary,
            tags: action.tags,
            sourceRefs: action.sourceRefs,
            memoryRefs: [],
            revisionNote: action.revisionNote,
            createdBy: "agent:llm_wiki_curator",
          }),
        );
      }
      if (action.type === "update") {
        pages.push(
          this.repo.updatePage(action.pageId, {
            markdown: action.updatedMarkdown,
            sourceRefs: action.sourceRefs,
            revisionNote: action.revisionNote,
            createdBy: "agent:llm_wiki_curator",
          }).page,
        );
      }
      if (action.type === "merge") {
        pages.push(
          this.repo.mergePages({
            sourcePageIds: action.sourcePageIds,
            targetTitle: action.targetTitle,
            mergedMarkdown: action.mergedMarkdown,
            sourceRefs: action.sourceRefs,
            revisionNote: action.revisionNote,
            actor: "agent:llm_wiki_curator",
          }),
        );
      }
      if (action.type === "archive") {
        pages.push(
          this.repo.archivePage(
            action.pageId,
            action.reason,
            "agent:llm_wiki_curator",
          ),
        );
      }
      if (action.type === "cross_link") {
        this.repo.addLink(
          action.fromPageId,
          action.toPageId,
          action.linkType,
          action.reason,
          "agent:llm_wiki_curator",
        );
      }
    }
    return {
      pages,
      memoryPointers: pages.map((page) => ({
        kind: "wiki_pointer",
        summary: `Wiki page updated: ${page.title}`,
        semanticText: `Wiki pointer ${page.id} ${page.title} ${page.summary}`,
        sourceRefs: page.sourceRefs,
      })),
    };
  }
}

export class ContradictionChecker {
  constructor(private readonly repo: WikiRepository) {}

  findContradictions(
    candidateClaims: string[],
  ): Array<{ claim: string; pageId: string; reason: string }> {
    const pages = this.repo
      .listPages()
      .filter((page) => page.status === "active");
    const conflicts: Array<{ claim: string; pageId: string; reason: string }> =
      [];
    for (const claim of candidateClaims) {
      const normalizedClaim = normalizeClaim(claim);
      for (const page of pages) {
        const existing = normalizeClaim(
          `${page.title} ${page.summary} ${this.repo.getPage(page.id)?.markdown ?? ""}`,
        );
        if (isNegatedConflict(normalizedClaim, existing)) {
          conflicts.push({
            claim,
            pageId: page.id,
            reason: "Candidate claim negates an existing wiki claim.",
          });
          break;
        }
      }
    }
    return conflicts;
  }
}

export interface LegacyWikiRevision {
  id: string;
  body: string;
  note: string;
  sourceRefs: unknown[];
}

export interface LegacyWikiPage {
  id: string;
  title: string;
  body: string;
  sourceRefs: unknown[];
  revisions: LegacyWikiRevision[];
  archived: boolean;
}

export class WikiStore {
  private readonly pages = new Map<string, LegacyWikiPage>();

  create(title: string, body: string, sourceRefs: unknown[]): LegacyWikiPage {
    const id = createId();
    const revision = this.revision(body, "create", sourceRefs);
    const page: LegacyWikiPage = {
      id,
      title,
      body,
      sourceRefs,
      revisions: [revision],
      archived: false,
    };
    this.pages.set(id, page);
    return cloneLegacyPage(page);
  }

  update(
    id: string,
    body: string,
    sourceRefs: unknown[],
    note: string,
  ): LegacyWikiPage {
    const page = this.requireLegacyPage(id);
    page.body = body;
    page.sourceRefs = sourceRefs;
    page.revisions.push(this.revision(body, note, sourceRefs));
    return cloneLegacyPage(page);
  }

  revert(id: string, revisionId: string, reason: string): LegacyWikiPage {
    const page = this.requireLegacyPage(id);
    const revision = page.revisions.find(
      (candidate) => candidate.id === revisionId,
    );
    if (!revision) throw new Error(`Revision not found: ${revisionId}`);
    page.body = revision.body;
    page.revisions.push(
      this.revision(revision.body, `revert: ${reason}`, revision.sourceRefs),
    );
    return cloneLegacyPage(page);
  }

  search(query: string): LegacyWikiPage[] {
    const needle = query.toLowerCase();
    return [...this.pages.values()]
      .filter((page) => !page.archived)
      .filter((page) =>
        `${page.title} ${page.body}`.toLowerCase().includes(needle),
      )
      .map(cloneLegacyPage);
  }

  private requireLegacyPage(id: string): LegacyWikiPage {
    const page = this.pages.get(id);
    if (!page) throw new Error(`Wiki page not found: ${id}`);
    return page;
  }

  private revision(
    body: string,
    note: string,
    sourceRefs: unknown[],
  ): LegacyWikiRevision {
    return { id: createId(), body, note, sourceRefs };
  }
}

function cloneLegacyPage(page: LegacyWikiPage): LegacyWikiPage {
  return {
    ...page,
    sourceRefs: [...page.sourceRefs],
    revisions: page.revisions.map((revision) => ({
      ...revision,
      sourceRefs: [...revision.sourceRefs],
    })),
  };
}

function assertMarkdownHasSourceLinks(
  markdown: string,
  sourceRefs: SourceRef[],
): void {
  for (const ref of sourceRefs) {
    if (!markdown.includes(`[source:${ref.id}]`)) {
      throw new Error(`Markdown must include source link [source:${ref.id}]`);
    }
  }
}

function currentStorageKey(category: WikiPageCategory, slug: string): string {
  const categoryDir: Record<WikiPageCategory, string> = {
    thesis: "theses",
    strategy: "strategies",
    risk_lesson: "risk-lessons",
    instrument: "instruments",
    workflow: "workflows",
    glossary: "glossary",
  };
  return join(categoryDir[category], `${slug}.md`);
}

function mergeSourceRefs(left: SourceRef[], right: SourceRef[]): SourceRef[] {
  const byKey = new Map<string, SourceRef>();
  for (const ref of [...left, ...right]) {
    byKey.set(`${ref.type}:${ref.id}`, ref);
  }
  return [...byKey.values()];
}

function normalizeClaim(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNegatedConflict(claim: string, existing: string): boolean {
  const withoutNegation = claim.replace(/\bnot\s+/g, "");
  return claim !== withoutNegation && existing.includes(withoutNegation);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content, "utf8");
  const fd = openSync(tmp, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
}

function createId(): string {
  return crypto.randomUUID();
}
