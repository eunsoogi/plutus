import { slugify, unique } from "./helpers";
import type { WikiRepository } from "./repository";
import type { MergePagesInput } from "./repository-state";
import type { WikiPage } from "./types";

export function mergeRepositoryPages(
  repo: WikiRepository,
  input: MergePagesInput,
): WikiPage {
  const [firstSource] = input.sourcePageIds.map((id) => requirePage(repo, id));
  if (!firstSource) throw new Error("At least one source page is required.");
  const target = repo.createPage({
    profileId: firstSource.profileId,
    category: firstSource.category,
    title: input.targetTitle,
    slug: slugify(input.targetTitle),
    markdown: input.mergedMarkdown,
    summary: input.targetTitle,
    tags: unique(input.sourcePageIds.flatMap((id) => requirePage(repo, id).tags)),
    sourceRefs: input.sourceRefs,
    memoryRefs: unique(
      input.sourcePageIds.flatMap((id) => requirePage(repo, id).memoryRefs),
    ),
    revisionNote: input.revisionNote,
    createdBy: input.actor,
  });
  for (const sourceId of input.sourcePageIds) {
    repo.archivePage(sourceId, `Merged into ${target.id}`, input.actor);
  }
  repo.recordMerge(target.id, input.actor, input.sourceRefs, {
    sourcePageIds: input.sourcePageIds,
  });
  return target;
}

function requirePage(repo: WikiRepository, id: string): WikiPage {
  const page = repo.getPage(id)?.page;
  if (!page) throw new Error(`Wiki page not found: ${id}`);
  return page;
}
