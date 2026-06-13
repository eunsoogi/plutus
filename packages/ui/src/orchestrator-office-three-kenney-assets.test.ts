import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createOfficeThreeSceneCatalog,
  officeThreeKenneyFurnitureKit,
} from "./orchestrator-office-three-scene";

const kenneyAssetRoot = join(
  new URL(".", import.meta.url).pathname,
  "assets/kenney-furniture-kit",
);

describe("office Three.js Kenney furniture kit remodel", () => {
  it("documents the static Kenney Furniture Kit source used for the office model", () => {
    expect(officeThreeKenneyFurnitureKit).toMatchObject({
      assetPageUrl: "https://kenney.nl/assets/furniture-kit",
      category: "3D",
      files: 140,
      license: "Creative Commons CC0",
      name: "Kenney Furniture Kit",
    });
    expect(officeThreeKenneyFurnitureKit.referencedAssets).toEqual(
      expect.arrayContaining([
        "desk",
        "chairDesk",
        "computerScreen",
        "computerKeyboard",
        "computerMouse",
        "bookcaseOpen",
        "coatRackStanding",
        "lampSquareFloor",
        "plantSmall1",
        "rugRectangle",
      ]),
    );
  });

  it("ships a downloaded Kenney Furniture Kit subset with source and checksum provenance", () => {
    const manifestPath = join(kenneyAssetRoot, "manifest.json");

    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      readonly assetPageUrl?: string;
      readonly downloadedArchiveSha256?: string;
      readonly license?: string;
      readonly files?: readonly { readonly path: string }[];
    };

    expect(manifest).toMatchObject({
      assetPageUrl: "https://kenney.nl/assets/furniture-kit",
      downloadedArchiveSha256:
        "e67652d0932cee41683f74711c03d3e192a2af9979ef8e6b237711f5482d46b0",
      license: "Creative Commons CC0",
    });
    expect(manifest.files?.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "isometric/desk_SE.png",
        "isometric/chairDesk_SE.png",
        "isometric/computerScreen_SE.png",
        "isometric/bookcaseOpen_SE.png",
        "isometric/plantSmall1_SE.png",
      ]),
    );
    for (const file of manifest.files ?? []) {
      expect(existsSync(join(kenneyAssetRoot, file.path))).toBe(true);
    }
  });

  it("builds the office from Kenney-inspired desks, seating, storage, decor, and computer details", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });
    const roles: readonly (string | undefined)[] = contract.scene.objects.map(
      (object) => object.modelRole,
    );
    const runtimeUrls = contract.scene.objects
      .flatMap((object) => [object.id, object.label])
      .filter((value) => value.includes("http"));
    const deskCount = contract.scene.objects.filter(
      (object) => object.kind === "desk",
    ).length;

    expect(roles).toEqual(
      expect.arrayContaining([
        "kenney-bookcase-open",
        "kenney-coat-rack",
        "kenney-computer-keyboard",
        "kenney-computer-mouse",
        "kenney-computer-screen",
        "kenney-desk",
        "kenney-desk-chair",
        "kenney-floor-lamp",
        "kenney-plant-small",
        "kenney-rug-rectangle",
        "kenney-storage-box",
      ]),
    );
    expect(roles.filter((role) => role === "kenney-desk")).toHaveLength(
      deskCount,
    );
    expect(
      roles.filter((role) => role === "kenney-computer-keyboard"),
    ).toHaveLength(deskCount);
    expect(runtimeUrls).toEqual([]);
  });
});
