import { createId } from "./helpers";

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
