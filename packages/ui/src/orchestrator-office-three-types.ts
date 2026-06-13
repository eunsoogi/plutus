import type {
  Camera,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const officeThreeRendererContractVersion =
  "office-three-renderer/v1" as const;

export type OfficeThreeRendererContractVersion =
  typeof officeThreeRendererContractVersion;

export type OfficeThreeVector3 = readonly [number, number, number];

export type OfficeThreeGeometryShape = "box" | "cylinder" | "plane" | "sphere";

export type OfficeThreeMotionMode = "active" | "idle";

export type OfficeThreeMotionState = {
  readonly mode: OfficeThreeMotionMode;
};

export type OfficeThreeRendererDiagnostics = {
  readonly motionFrame: number;
  readonly motionMode: OfficeThreeMotionMode;
  readonly motionSample: string;
  readonly motionSampleObjectId?: string;
};

export type OfficeThreeModelRole =
  | "agent-body"
  | "agent-badge"
  | "agent-arm"
  | "agent-foot"
  | "agent-head"
  | "agent-leg"
  | "cabinet-body"
  | "cabinet-door"
  | "cabinet-handle"
  | "cabinet-panel"
  | "cabinet-shelf"
  | "chair-back"
  | "chair-leg"
  | "chair-seat"
  | "contact-pad"
  | "coffee-table-leg"
  | "coffee-table-top"
  | "desk-drawer"
  | "desk-edge"
  | "desk-equipment-cluster"
  | "desk-inset-panel"
  | "desk-leg"
  | "desk-lip"
  | "desk-surface"
  | "fixture-body"
  | "kenney-bookcase-open"
  | "kenney-coat-rack"
  | "kenney-computer-keyboard"
  | "kenney-computer-mouse"
  | "kenney-computer-screen"
  | "kenney-desk"
  | "kenney-desk-chair"
  | "kenney-floor-lamp"
  | "kenney-plant-small"
  | "kenney-rug-rectangle"
  | "kenney-storage-box"
  | "partition-panel"
  | "report-bench-leg"
  | "report-bench-seat"
  | "rug-zone"
  | "sofa-arm"
  | "sofa-back"
  | "sofa-cushion"
  | "sofa-seat"
  | "terminal-panel"
  | "terminal-screen"
  | "monitor-screen"
  | "monitor-stand"
  | "plant-leaf"
  | "planter-pot"
  | "wall-base-rail"
  | "wall-panel"
  | "wall-trim";

type OfficeThreeSceneObjectBase = {
  readonly assetImageUrl?: string;
  readonly color: string;
  readonly id: string;
  readonly label: string;
  readonly modelRole?: OfficeThreeModelRole;
  readonly opacity?: number;
  readonly position: OfficeThreeVector3;
  readonly rotation?: OfficeThreeVector3;
  readonly shape?: OfficeThreeGeometryShape;
  readonly visible?: boolean;
};

export type OfficeThreeAgentObject = OfficeThreeSceneObjectBase & {
  readonly kind: "agent";
  readonly radius: number;
  readonly role?: string;
};

export type OfficeThreeDeskObject = OfficeThreeSceneObjectBase & {
  readonly kind: "desk";
  readonly scale: OfficeThreeVector3;
  readonly stationId?: string;
};

export type OfficeThreeRoomObject = OfficeThreeSceneObjectBase & {
  readonly kind: "room";
  readonly scale: OfficeThreeVector3;
};

export type OfficeThreeAmenityObject = OfficeThreeSceneObjectBase & {
  readonly kind: "amenity";
  readonly scale: OfficeThreeVector3;
};

export type OfficeThreeNameplateObject = OfficeThreeSceneObjectBase & {
  readonly kind: "nameplate";
  readonly scale: OfficeThreeVector3;
  readonly text: string;
};

export type OfficeThreeSceneObject =
  | OfficeThreeAgentObject
  | OfficeThreeAmenityObject
  | OfficeThreeDeskObject
  | OfficeThreeNameplateObject
  | OfficeThreeRoomObject;

export type OfficeThreeSceneState = {
  readonly background: string;
  readonly motion: OfficeThreeMotionState;
  readonly objects: readonly OfficeThreeSceneObject[];
};

export type OfficeThreeCameraState = {
  readonly far: number;
  readonly fov: number;
  readonly kind: "perspective";
  readonly near: number;
  readonly position: OfficeThreeVector3;
  readonly target: OfficeThreeVector3;
};

export type OfficeThreeOrbitControlsState = {
  readonly enableDamping: boolean;
  readonly enablePan: boolean;
  readonly enableRotate: boolean;
  readonly enableZoom: boolean;
  readonly enabled: boolean;
  readonly maxDistance: number;
  readonly maxPolarAngle: number;
  readonly minDistance: number;
  readonly minPolarAngle: number;
};

export type OfficeThreeInteractionState = {
  readonly controls: OfficeThreeOrbitControlsState;
  readonly hoveredObjectId?: string;
  readonly selectedObjectId?: string;
};

export type OfficeThreeRuntimeHandles = {
  readonly camera: Camera | PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly meshesByObjectId: ReadonlyMap<string, Mesh>;
  readonly renderer: WebGLRenderer;
  readonly root: Object3D;
  readonly scene: Scene;
};

export type OfficeThreeRendererContract = {
  readonly camera: OfficeThreeCameraState;
  readonly interaction: OfficeThreeInteractionState;
  readonly scene: OfficeThreeSceneState;
  readonly version: OfficeThreeRendererContractVersion;
};

export type OfficeThreeRendererContractInput = {
  readonly camera?: OfficeThreeCameraState;
  readonly interaction?: OfficeThreeInteractionState;
  readonly scene: {
    readonly background?: string;
    readonly motion?: OfficeThreeMotionState;
    readonly objects: readonly OfficeThreeSceneObject[];
  };
};

export const officeThreeCameraDefaults = {
  far: 100,
  fov: 45,
  kind: "perspective",
  near: 0.1,
  position: [4.41, 6.27, 5.13],
  target: [0, 0.18, 0],
} satisfies OfficeThreeCameraState;

export const officeThreeInteractionDefaults = {
  controls: {
    enableDamping: true,
    enablePan: true,
    enableRotate: true,
    enableZoom: true,
    enabled: true,
    maxDistance: 13,
    maxPolarAngle: 1.31,
    minDistance: 3.2,
    minPolarAngle: 0.48,
  },
} satisfies OfficeThreeInteractionState;

export const officeThreeMotionDefaults = {
  mode: "idle",
} satisfies OfficeThreeMotionState;

export function createOfficeThreeRendererContract(
  input: OfficeThreeRendererContractInput,
): OfficeThreeRendererContract {
  return {
    camera: input.camera ?? officeThreeCameraDefaults,
    interaction: input.interaction ?? officeThreeInteractionDefaults,
    scene: {
      background: input.scene.background ?? "#10100d",
      motion: input.scene.motion ?? officeThreeMotionDefaults,
      objects: input.scene.objects,
    },
    version: officeThreeRendererContractVersion,
  };
}
