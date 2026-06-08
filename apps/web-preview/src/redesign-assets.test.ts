import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";

type SourceFile = {
  readonly content: string;
  readonly path: string;
};

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const gradientPattern =
  /\b(?:linear-gradient|radial-gradient|repeating-linear-gradient)\s*\(/giu;

const TauriConfigSchema = z.object({
  bundle: z.object({
    icon: z.array(z.string()),
  }),
});

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function listFiles(startPath: string, extension: string): SourceFile[] {
  const absoluteStartPath = join(repoRoot, startPath);
  const files: SourceFile[] = [];
  for (const entry of readdirSync(absoluteStartPath)) {
    const absoluteEntryPath = join(absoluteStartPath, entry);
    const stats = statSync(absoluteEntryPath);
    if (stats.isDirectory()) {
      files.push(
        ...listFiles(relative(repoRoot, absoluteEntryPath), extension),
      );
      continue;
    }
    if (absoluteEntryPath.endsWith(extension)) {
      files.push({
        path: relative(repoRoot, absoluteEntryPath),
        content: readFileSync(absoluteEntryPath, "utf8"),
      });
    }
  }
  return files;
}

describe("redesign asset and style constraints", () => {
  it("keeps committed web preview CSS free from gradient decorations", () => {
    // Given: the redesigned shell uses committed CSS from the web preview app.
    const cssFiles = listFiles("apps/web-preview/src", ".css");

    // When: the CSS is scanned for decorative gradient functions.
    const gradientHits = cssFiles.flatMap((file) => {
      const matches = file.content.match(gradientPattern) ?? [];
      return matches.map((match) => `${file.path}: ${match}`);
    });

    // Then: no app CSS relies on linear, radial, or repeating gradients.
    expect(gradientHits).toEqual([]);
  });

  it("references the generated abstract image in both READMEs instead of the old hero screenshot", () => {
    // Given: README branding is part of the redesign acceptance criteria.
    const readmePaths = ["README.md", "README.ko.md"] as const;

    // When/Then: the old screenshot path is gone and the replacement image exists.
    for (const readmePath of readmePaths) {
      const readme = readWorkspaceFile(readmePath);
      const readmeImageRefs = Array.from(
        readme.matchAll(/src="\.\/([^"]+)"/gu),
        (match) => match[1] ?? "",
      );
      expect(readmeImageRefs).not.toContain("assets/readme/plutus-hero.png");
      expect(readmeImageRefs).toContain("assets/readme/plutus-abstract.png");
    }
    expect(existsSync(join(repoRoot, "assets/readme/plutus-abstract.png"))).toBe(
      true,
    );
  });

  it("configures generated Tauri icon assets for the packaged macOS app", () => {
    // Given: the packaged app should use checked-in Plutus icon assets.
    const config = TauriConfigSchema.parse(
      JSON.parse(readWorkspaceFile("apps/tauri/src-tauri/tauri.conf.json")),
    );
    const configDir = join(repoRoot, "apps/tauri/src-tauri");

    // When: bundle icon references are resolved relative to tauri.conf.json.
    const missingIconRefs = config.bundle.icon.filter(
      (iconRef) => !existsSync(join(configDir, iconRef)),
    );

    // Then: the bundle references concrete generated icon files.
    expect(config.bundle.icon).toEqual(
      expect.arrayContaining([
        "icons/icon.png",
        "icons/icon.icns",
        "icons/icon.ico",
      ]),
    );
    expect(missingIconRefs).toEqual([]);
  });
});
