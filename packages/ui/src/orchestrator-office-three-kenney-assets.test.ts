import { describe, expect, it } from "vitest";
import {
  createOfficeThreeSceneCatalog,
  officeThreeKenneyFurnitureKit,
} from "./orchestrator-office-three-scene";

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
