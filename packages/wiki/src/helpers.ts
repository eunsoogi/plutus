import { createHash } from "node:crypto";
import { closeSync, fsyncSync, openSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceRef, WikiPageCategory } from "./schemas";

export function assertMarkdownHasSourceLinks(
  markdown: string,
  sourceRefs: SourceRef[],
): void {
  for (const ref of sourceRefs) {
    if (!markdown.includes(`[source:${ref.id}]`)) {
      throw new Error(`Markdown must include source link [source:${ref.id}]`);
    }
  }
}

export function currentStorageKey(
  category: WikiPageCategory,
  slug: string,
): string {
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

export function mergeSourceRefs(
  left: SourceRef[],
  right: SourceRef[],
): SourceRef[] {
  const byKey = new Map<string, SourceRef>();
  for (const ref of [...left, ...right]) {
    byKey.set(`${ref.type}:${ref.id}`, ref);
  }
  return [...byKey.values()];
}

export function normalizeClaim(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNegatedConflict(claim: string, existing: string): boolean {
  const withoutNegation = claim.replace(/\bnot\s+/g, "");
  return claim !== withoutNegation && existing.includes(withoutNegation);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function atomicWrite(path: string, content: string): void {
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

export function createId(): string {
  return crypto.randomUUID();
}
