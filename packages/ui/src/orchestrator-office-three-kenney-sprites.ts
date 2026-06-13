import type {
  OfficeThreeAmenityObject,
  OfficeThreeModelRole,
  OfficeThreeVector3,
} from "./orchestrator-office-three-types";

type KenneySpriteDefinition = {
  readonly fileName: string;
  readonly id: string;
  readonly label: string;
  readonly modelRole: OfficeThreeModelRole;
  readonly position: OfficeThreeVector3;
  readonly scale: OfficeThreeVector3;
};

const spriteDefinitions = [
  {
    fileName: "floorFull_SE.png",
    id: "kenney-real:floor-tile",
    label: "Kenney floor tile",
    modelRole: "kenney-rug-rectangle",
    position: [-2.4, 0.13, 1.8],
    scale: [2.3, 1.55, 1],
  },
  {
    fileName: "wall_SE.png",
    id: "kenney-real:wall",
    label: "Kenney wall panel",
    modelRole: "wall-panel",
    position: [2.55, 1.08, -1.45],
    scale: [2.7, 2.2, 1],
  },
  {
    fileName: "desk_SE.png",
    id: "kenney-real:command-desk",
    label: "Kenney desk",
    modelRole: "kenney-desk",
    position: [-0.05, 1.15, 0.25],
    scale: [1.95, 1.35, 1],
  },
  {
    fileName: "chairDesk_SE.png",
    id: "kenney-real:chair-market",
    label: "Kenney desk chair",
    modelRole: "kenney-desk-chair",
    position: [-1.34, 0.9, 0.85],
    scale: [0.9, 1.05, 1],
  },
  {
    fileName: "computerScreen_SE.png",
    id: "kenney-real:monitor",
    label: "Kenney computer screen",
    modelRole: "kenney-computer-screen",
    position: [0.15, 1.86, -0.28],
    scale: [0.82, 0.76, 1],
  },
  {
    fileName: "computerKeyboard_SE.png",
    id: "kenney-real:keyboard",
    label: "Kenney computer keyboard",
    modelRole: "kenney-computer-keyboard",
    position: [0.14, 1.33, 0.28],
    scale: [0.72, 0.36, 1],
  },
  {
    fileName: "computerMouse_SE.png",
    id: "kenney-real:mouse",
    label: "Kenney computer mouse",
    modelRole: "kenney-computer-mouse",
    position: [0.76, 1.28, 0.42],
    scale: [0.38, 0.28, 1],
  },
  {
    fileName: "bookcaseOpen_SE.png",
    id: "kenney-real:bookcase",
    label: "Kenney open bookcase",
    modelRole: "kenney-bookcase-open",
    position: [1.85, 1.36, -0.72],
    scale: [1.12, 1.62, 1],
  },
  {
    fileName: "plantSmall1_SE.png",
    id: "kenney-real:plant-left",
    label: "Kenney small plant",
    modelRole: "kenney-plant-small",
    position: [-2.15, 1.02, -0.88],
    scale: [0.78, 1.05, 1],
  },
  {
    fileName: "lampSquareFloor_SE.png",
    id: "kenney-real:floor-lamp",
    label: "Kenney floor lamp",
    modelRole: "kenney-floor-lamp",
    position: [2.42, 1.25, 0.75],
    scale: [0.82, 1.55, 1],
  },
  {
    fileName: "rugRectangle_SE.png",
    id: "kenney-real:rug",
    label: "Kenney rectangle rug",
    modelRole: "kenney-rug-rectangle",
    position: [-0.5, 0.23, 1.72],
    scale: [1.7, 0.9, 1],
  },
  {
    fileName: "tableCoffee_SE.png",
    id: "kenney-real:coffee-table",
    label: "Kenney coffee table",
    modelRole: "kenney-desk",
    position: [1.45, 0.7, 1.42],
    scale: [1.08, 0.82, 1],
  },
  {
    fileName: "cardboardBoxClosed_SE.png",
    id: "kenney-real:storage-box",
    label: "Kenney storage box",
    modelRole: "kenney-storage-box",
    position: [-2.75, 0.64, 0.0],
    scale: [0.75, 0.68, 1],
  },
] as const satisfies readonly KenneySpriteDefinition[];

function assetUrlFor(fileName: string): string {
  return new URL(
    `./assets/kenney-furniture-kit/isometric/${fileName}`,
    import.meta.url,
  ).href;
}

export const kenneyOfficeOverlaySprites = spriteDefinitions.map((sprite) => ({
  id: sprite.id,
  imageUrl: assetUrlFor(sprite.fileName),
  label: sprite.label,
})) as readonly {
  readonly id: string;
  readonly imageUrl: string;
  readonly label: string;
}[];

export function kenneySpriteObjects(): readonly OfficeThreeAmenityObject[] {
  return spriteDefinitions.map((sprite) => ({
    assetImageUrl: assetUrlFor(sprite.fileName),
    color: "#ffffff",
    id: sprite.id,
    kind: "amenity",
    label: sprite.label,
    modelRole: sprite.modelRole,
    position: sprite.position,
    scale: sprite.scale,
    shape: "plane",
  }));
}
