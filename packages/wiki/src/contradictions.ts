import { isNegatedConflict, normalizeClaim } from "./helpers";
import type { WikiRepository } from "./repository";

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
