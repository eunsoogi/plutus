import type {
  OfficeThreeRendererContract,
  OfficeThreeRendererDiagnostics,
} from "./orchestrator-office-three-types";
import type { OfficeThreeVector3 } from "./orchestrator-office-three-types";

export type OfficeThreeCanvasSize = {
  readonly height: number;
  readonly width: number;
};

export type OfficeThreeRendererCanvas = OfficeThreeCanvasSize & {
  readonly clientHeight: number;
  readonly clientWidth: number;
};

export type OfficeThreeAnimationFrameScheduler = {
  readonly cancel: (id: number) => void;
  readonly request: (callback: (time: number) => void) => number;
};

export type OfficeThreeMaterialInput = {
  readonly color: string;
  readonly opacity: number;
};

export type OfficeThreeRendererAdapter<
  TCanvas extends OfficeThreeRendererCanvas,
  TRenderer,
  TScene,
  TCamera,
  TNode,
  TMesh extends TNode,
  TGeometry,
  TMaterial,
  TBackground,
> = {
  readonly addToObject: (parent: TNode, child: TNode) => void;
  readonly addToScene: (scene: TScene, child: TNode) => void;
  readonly createAmbientLight: (color: string, intensity: number) => TNode;
  readonly createBoxGeometry: () => TGeometry;
  readonly createColor: (color: string) => TBackground;
  readonly createCylinderGeometry: () => TGeometry;
  readonly createDirectionalLight: (color: string, intensity: number) => TNode;
  readonly createMaterial: (input: OfficeThreeMaterialInput) => TMaterial;
  readonly createMesh: (geometry: TGeometry, material: TMaterial) => TMesh;
  readonly createPerspectiveCamera: (
    fov: number,
    aspect: number,
    near: number,
    far: number,
  ) => TCamera;
  readonly createRenderer: (input: {
    readonly antialias: boolean;
    readonly canvas: TCanvas;
  }) => TRenderer;
  readonly createRoot: () => TNode;
  readonly createScene: () => TScene;
  readonly createSphereGeometry: (radius: number) => TGeometry;
  readonly disposeGeometry: (geometry: TGeometry) => void;
  readonly disposeMaterial: (material: TMaterial) => void;
  readonly disposeRenderer: (renderer: TRenderer) => void;
  readonly pointCameraAt: (camera: TCamera, target: OfficeThreeVector3) => void;
  readonly render: (
    renderer: TRenderer,
    scene: TScene,
    camera: TCamera,
  ) => void;
  readonly setCameraAspect: (camera: TCamera, aspect: number) => void;
  readonly setPixelRatio: (renderer: TRenderer, pixelRatio: number) => void;
  readonly setPosition: (
    target: TCamera | TNode,
    position: OfficeThreeVector3,
  ) => void;
  readonly setRotation: (node: TNode, rotation: OfficeThreeVector3) => void;
  readonly setScale: (node: TNode, scale: OfficeThreeVector3) => void;
  readonly setSceneBackground: (scene: TScene, background: TBackground) => void;
  readonly setSize: (
    renderer: TRenderer,
    width: number,
    height: number,
    updateStyle: boolean,
  ) => void;
  readonly setVisible: (node: TNode, visible: boolean) => void;
  readonly updateProjectionMatrix: (camera: TCamera) => void;
};

export type OfficeThreeRendererLifecycle<
  TRenderer,
  TScene,
  TCamera,
  TNode,
  TMesh extends TNode,
> = {
  readonly camera: TCamera;
  readonly dispose: () => void;
  readonly getDiagnostics: () => OfficeThreeRendererDiagnostics;
  readonly meshesByObjectId: ReadonlyMap<string, TMesh>;
  readonly render: () => void;
  readonly renderer: TRenderer;
  readonly resize: (size: OfficeThreeCanvasSize) => void;
  readonly root: TNode;
  readonly scene: TScene;
  readonly start: () => void;
  readonly stop: () => void;
};

export type OfficeThreeRendererLifecycleInput<
  TCanvas extends OfficeThreeRendererCanvas,
  TRenderer,
  TScene,
  TCamera,
  TNode,
  TMesh extends TNode,
  TGeometry,
  TMaterial,
  TBackground,
> = {
  readonly adapter: OfficeThreeRendererAdapter<
    TCanvas,
    TRenderer,
    TScene,
    TCamera,
    TNode,
    TMesh,
    TGeometry,
    TMaterial,
    TBackground
  >;
  readonly animationFrame: OfficeThreeAnimationFrameScheduler;
  readonly canvas: TCanvas;
  readonly contract: OfficeThreeRendererContract;
  readonly onFrameDiagnostics?: (
    diagnostics: OfficeThreeRendererDiagnostics,
  ) => void;
  readonly pixelRatio?: number;
};
