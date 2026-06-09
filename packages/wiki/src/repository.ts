import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SourceRef } from "./schemas";
import { assertMarkdownHasSourceLinks, atomicWrite, createId, currentStorageKey, mergeSourceRefs, sha256 } from "./helpers";
import { mergeRepositoryPages } from "./repository-merge";
import { buildPage, clonePage, hydrateRepositoryState, type CreatePageInput, type CreateRevisionInput, type MergePagesInput, type UpdatePageInput } from "./repository-state";
import type { WikiActivity, WikiPage, WikiPageBundle, WikiRepositoryState, WikiRevision } from "./types";

export class WikiRepository {
  readonly activity: WikiActivity[] = [];
  private readonly pages = new Map<string, WikiPage>();
  private readonly revisions = new Map<string, WikiRevision[]>();
  private readonly links: WikiRepositoryState["links"] = [];

  constructor(private readonly options: { rootDir: string }) {
    mkdirSync(this.options.rootDir, { recursive: true });
    this.loadState();
  }

  createPage(input: CreatePageInput): WikiPage {
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
    const page = buildPage({ input, id, now, storageKey, revision });
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

  updatePage(pageId: string, input: UpdatePageInput): WikiPageBundle {
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

  mergePages(input: MergePagesInput): WikiPage {
    return mergeRepositoryPages(this, input);
  }

  recordMerge(
    pageId: string,
    actor: string,
    sourceRefs: SourceRef[],
    payload: Record<string, unknown>,
  ): void {
    this.log({ pageId, eventType: "merged", actor, sourceRefs, payload });
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
        ...clonePage(page),
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

  private createRevision(input: CreateRevisionInput): WikiRevision {
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
      hydrateRepositoryState(parsed, this.pages, this.revisions);
      this.activity.push(...(parsed.activity ?? []));
      this.links.push(...(parsed.links ?? []));
    } catch (error) {
      if (error instanceof Error) return;
      throw error;
    }
  }
}
