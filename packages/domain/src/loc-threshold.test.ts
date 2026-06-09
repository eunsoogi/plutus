import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const maxPureLoc = 250;

const sourceExtensions = new Set([
  ".cjs",
  ".js",
  ".mjs",
  ".rs",
  ".ts",
  ".tsx",
]);

const ignoredDirectoryNames = new Set([
  ".git",
  ".turbo",
  "dist",
  "node_modules",
  "target",
]);

function sourceFilesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      return ignoredDirectoryNames.has(entry) ? [] : sourceFilesIn(absolutePath);
    }

    return sourceExtensions.has(extname(entry)) ? [absolutePath] : [];
  });
}

function pureLocFor(filePath: string): number {
  return readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();

      return (
        trimmed.length > 0 &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("--")
      );
    }).length;
}

describe("source file LOC ceiling", () => {
  it("keeps every source file at or below the 250 pure LOC ceiling", () => {
    const overLimit = sourceFilesIn(repoRoot)
      .map((filePath) => ({
        filePath: relative(repoRoot, filePath),
        pureLoc: pureLocFor(filePath),
      }))
      .filter(({ pureLoc }) => pureLoc > maxPureLoc)
      .sort((left, right) => right.pureLoc - left.pureLoc);

    expect(overLimit).toEqual([]);
  });
});
