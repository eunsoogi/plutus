import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";

type SourceFile = {
  readonly content: string;
  readonly path: string;
};

type ReadmeImage = {
  readonly alt: string;
  readonly height: string;
  readonly src: string;
  readonly width: string;
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

function readHtmlAttribute(attributes: string, name: string): string {
  return attributes.match(new RegExp(`\\b${name}="([^"]+)"`, "iu"))?.[1] ?? "";
}

function listReadmeImages(content: string): ReadmeImage[] {
  return Array.from(content.matchAll(/<img\b([^>]*)>/giu), (match) => {
    const attributes = match[1] ?? "";
    return {
      alt: readHtmlAttribute(attributes, "alt"),
      height: readHtmlAttribute(attributes, "height"),
      src: readHtmlAttribute(attributes, "src"),
      width: readHtmlAttribute(attributes, "width"),
    };
  });
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

function readPngDimensions(relativePath: string): {
  readonly height: number;
  readonly width: number;
} {
  const png = readFileSync(join(repoRoot, relativePath));
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
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

  it("references a constrained emblem image in both READMEs instead of the old abstract artwork", () => {
    // Given: README branding is part of the redesign acceptance criteria.
    const readmePaths = ["README.md", "README.ko.md"] as const;
    const emblemPath = "./assets/readme/plutus-emblem.png";
    const requiredDisplaySize = {
      height: "168",
      width: "168",
    } as const;
    const bannedAltPattern = /\b(?:abstract|chart|market|workspace)\b/iu;
    const requiredAltPattern = /\b(?:emblem|icon)\b/iu;

    // When/Then: the old screenshot path is gone and the replacement image exists.
    for (const readmePath of readmePaths) {
      const readme = readWorkspaceFile(readmePath);
      const readmeImages = listReadmeImages(readme);
      const emblemImage = readmeImages.find(({ src }) => src === emblemPath);

      expect(
        readmeImages.map(({ src }) => src),
        `${readmePath} should drop the old README artwork paths`,
      ).not.toEqual(
        expect.arrayContaining([
          "./assets/readme/plutus-hero.png",
          "./assets/readme/plutus-abstract.png",
        ]),
      );
      expect(
        emblemImage?.alt,
        `${readmePath} should reference the emblem asset`,
      ).toBeDefined();
      expect(
        emblemImage,
        `${readmePath} should constrain emblem display`,
      ).toMatchObject(requiredDisplaySize);
      expect(emblemImage?.alt ?? "").toMatch(requiredAltPattern);
      expect(emblemImage?.alt ?? "").not.toMatch(bannedAltPattern);
    }

    expect(existsSync(join(repoRoot, emblemPath))).toBe(true);
    expect(readPngDimensions(emblemPath)).toEqual({
      width: 1024,
      height: 1024,
    });
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

  it("emits relative Vite assets for packaged Tauri webviews", () => {
    // Given: packaged Tauri webviews load frontend assets from an embedded app URL.
    const viteConfig = readWorkspaceFile("apps/web-preview/vite.config.ts");

    // Then: production HTML references assets relative to the root bundle.
    expect(viteConfig).toMatch(/\bbase:\s*["']\.\/["']/u);
  });
});
