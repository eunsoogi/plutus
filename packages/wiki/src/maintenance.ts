import { WikiMaintenancePlanSchema, type SourceRef, type WikiMaintenancePlan } from "./schemas";
import { WikiRepository } from "./repository";
import type { WikiPage } from "./types";

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
