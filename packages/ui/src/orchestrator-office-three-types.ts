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

type OfficeThreeSceneObjectBase = {
  readonly color: string;
  readonly id: string;
  readonly label: string;
  readonly opacity?: number;
  readonly position: OfficeThreeVector3;
  readonly rotation?: OfficeThreeVector3;
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
    readonly objects: readonly OfficeThreeSceneObject[];
  };
};

export const officeThreeCameraDefaults = {
  far: 100,
  fov: 45,
  kind: "perspective",
  near: 0.1,
  position: [5.6, 4.8, 6.4],
  target: [0, 0.42, 0],
} satisfies OfficeThreeCameraState;

export const officeThreeInteractionDefaults = {
  controls: {
    enableDamping: true,
    enablePan: true,
    enableRotate: true,
    enableZoom: true,
    enabled: true,
    maxDistance: 12,
    maxPolarAngle: 1.31,
    minDistance: 3.2,
    minPolarAngle: 0.48,
  },
} satisfies OfficeThreeInteractionState;

export function createOfficeThreeRendererContract(
  input: OfficeThreeRendererContractInput,
): OfficeThreeRendererContract {
  return {
    camera: input.camera ?? officeThreeCameraDefaults,
    interaction: input.interaction ?? officeThreeInteractionDefaults,
    scene: {
      background: input.scene.background ?? "#10100d",
      objects: input.scene.objects,
    },
    version: officeThreeRendererContractVersion,
  };
}
