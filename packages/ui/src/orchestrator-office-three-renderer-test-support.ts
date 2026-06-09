import type {
  OfficeThreeSceneObject,
  OfficeThreeVector3,
} from "./orchestrator-office-three-types";
import type { OfficeThreeRendererAdapter } from "./orchestrator-office-three-renderer";

export type FakeCanvas = {
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly height: number;
  readonly width: number;
};

type FakeVector = {
  readonly calls: OfficeThreeVector3[];
  readonly set: (x: number, y: number, z: number) => void;
};

export type FakeNode = {
  readonly children: FakeNode[];
  readonly kind: string;
  readonly name: string;
  readonly position: FakeVector;
  readonly rotation: FakeVector;
  readonly scale: FakeVector;
  visible: boolean;
};

export type FakeRenderer = {
  readonly disposed: string[];
  readonly renders: [FakeScene, FakeCamera][];
  readonly setPixelRatios: number[];
  readonly sizes: {
    readonly height: number;
    readonly updateStyle: boolean;
    readonly width: number;
  }[];
};

export type FakeScene = FakeNode & {
  background: string;
};

export type FakeCamera = FakeNode & {
  aspect: number;
  projectionUpdates: number;
};

export type FakeGeometry = {
  readonly disposed: string[];
  readonly kind: string;
};

export type FakeMaterial = {
  readonly color: string;
  readonly disposed: string[];
  readonly opacity: number;
};

export type FakeMesh = FakeNode & {
  readonly geometry: FakeGeometry;
  readonly material: FakeMaterial;
};

export type FakeAnimationFrameScheduler = {
  readonly canceled: number[];
  readonly queued: {
    readonly callback: (time: number) => void;
    readonly id: number;
  }[];
  readonly cancel: (id: number) => void;
  readonly request: (callback: (time: number) => void) => number;
};

export const sceneObjects = [
  {
    color: "#2563eb",
    id: "agent:orchestrator",
    kind: "agent",
    label: "Research Orchestrator",
    position: [0, 0.8, 0],
    radius: 0.32,
  },
  {
    color: "#d6bc8b",
    id: "desk:command",
    kind: "desk",
    label: "Command desk",
    modelRole: "desk-surface",
    opacity: 0.88,
    position: [0.4, 0.2, 0.6],
    rotation: [0, 0.2, 0],
    scale: [1.8, 0.4, 0.9],
  },
  {
    color: "#334155",
    id: "detail:monitor-stand",
    kind: "amenity",
    label: "Monitor stand",
    modelRole: "monitor-stand",
    position: [0.4, 0.58, 0.36],
    scale: [0.08, 0.24, 0.08],
    shape: "cylinder",
  },
] satisfies readonly OfficeThreeSceneObject[];

function fakeVector(): FakeVector {
  const calls: OfficeThreeVector3[] = [];
  return { calls, set: (x, y, z) => calls.push([x, y, z]) };
}

function fakeNode(kind: string, name: string): FakeNode {
  return {
    children: [],
    kind,
    name,
    position: fakeVector(),
    rotation: fakeVector(),
    scale: fakeVector(),
    visible: true,
  };
}

export function fakeScheduler(): FakeAnimationFrameScheduler {
  const canceled: number[] = [];
  const queued: FakeAnimationFrameScheduler["queued"] = [];

  return {
    canceled,
    queued,
    cancel: (id) => canceled.push(id),
    request: (callback) => {
      const id = queued.length + 1;
      queued.push({ callback, id });
      return id;
    },
  };
}

export function fakeOfficeThreeAdapter() {
  const renderer: FakeRenderer = {
    disposed: [],
    renders: [],
    setPixelRatios: [],
    sizes: [],
  };
  const materials: FakeMaterial[] = [];
  const geometries: FakeGeometry[] = [];

  const adapter = {
    addToObject: (parent: FakeNode, child: FakeNode) =>
      parent.children.push(child),
    addToScene: (scene: FakeScene, child: FakeNode) =>
      scene.children.push(child),
    createAmbientLight: (color: string, intensity: number) =>
      fakeNode("ambientLight", `${color}:${intensity}`),
    createBoxGeometry: () => {
      const geometry: FakeGeometry = { disposed: [], kind: "box" };
      geometries.push(geometry);
      return geometry;
    },
    createCylinderGeometry: () => {
      const geometry: FakeGeometry = { disposed: [], kind: "cylinder" };
      geometries.push(geometry);
      return geometry;
    },
    createColor: (color: string) => color,
    createDirectionalLight: (color: string, intensity: number) =>
      fakeNode("directionalLight", `${color}:${intensity}`),
    createMaterial: (input: {
      readonly color: string;
      readonly opacity: number;
    }) => {
      const material = {
        color: input.color,
        disposed: [],
        opacity: input.opacity,
      };
      materials.push(material);
      return material;
    },
    createMesh: (geometry: FakeGeometry, material: FakeMaterial): FakeMesh => ({
      ...fakeNode("mesh", `${geometry.kind}:${material.color}`),
      geometry,
      material,
    }),
    createPerspectiveCamera: (
      fov: number,
      aspect: number,
      near: number,
      far: number,
    ): FakeCamera => ({
      ...fakeNode("camera", `${fov}:${near}:${far}`),
      aspect,
      projectionUpdates: 0,
    }),
    createRenderer: () => renderer,
    createRoot: () => fakeNode("root", "office-root"),
    createScene: (): FakeScene => ({
      ...fakeNode("scene", "office-scene"),
      background: "",
    }),
    createSphereGeometry: (radius: number) => {
      const geometry: FakeGeometry = { disposed: [], kind: `sphere:${radius}` };
      geometries.push(geometry);
      return geometry;
    },
    disposeGeometry: (geometry: FakeGeometry) =>
      geometry.disposed.push(geometry.kind),
    disposeMaterial: (material: FakeMaterial) =>
      material.disposed.push(material.color),
    disposeRenderer: (target: FakeRenderer) => target.disposed.push("renderer"),
    pointCameraAt: (camera: FakeCamera, target: OfficeThreeVector3) =>
      camera.rotation.set(target[0], target[1], target[2]),
    render: (target: FakeRenderer, scene: FakeScene, camera: FakeCamera) =>
      target.renders.push([scene, camera]),
    setCameraAspect: (camera: FakeCamera, aspect: number) => {
      camera.aspect = aspect;
    },
    setPixelRatio: (target: FakeRenderer, pixelRatio: number) =>
      target.setPixelRatios.push(pixelRatio),
    setPosition: (node: FakeCamera | FakeNode, value: OfficeThreeVector3) =>
      node.position.set(value[0], value[1], value[2]),
    setRotation: (node: FakeNode, value: OfficeThreeVector3) =>
      node.rotation.set(value[0], value[1], value[2]),
    setScale: (node: FakeNode, value: OfficeThreeVector3) =>
      node.scale.set(value[0], value[1], value[2]),
    setSceneBackground: (scene: FakeScene, color: string) => {
      scene.background = color;
    },
    setSize: (
      target: FakeRenderer,
      width: number,
      height: number,
      updateStyle: boolean,
    ) => target.sizes.push({ height, updateStyle, width }),
    setVisible: (node: FakeNode, visible: boolean) => {
      node.visible = visible;
    },
    updateProjectionMatrix: (camera: FakeCamera) => {
      camera.projectionUpdates += 1;
    },
  } satisfies OfficeThreeRendererAdapter<
    FakeCanvas,
    FakeRenderer,
    FakeScene,
    FakeCamera,
    FakeNode,
    FakeMesh,
    FakeGeometry,
    FakeMaterial,
    string
  >;

  return { adapter, geometries, materials, renderer };
}
