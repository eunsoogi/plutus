import type {
  OfficeThreeAmenityObject,
  OfficeThreeGeometryShape,
  OfficeThreeModelRole,
  OfficeThreeVector3,
} from "./orchestrator-office-three-types";

export function detailObject(input: {
  readonly color: string;
  readonly id: string;
  readonly label: string;
  readonly modelRole: OfficeThreeModelRole;
  readonly opacity?: number;
  readonly position: OfficeThreeVector3;
  readonly rotation?: OfficeThreeVector3;
  readonly scale: OfficeThreeVector3;
  readonly shape?: OfficeThreeGeometryShape;
}): OfficeThreeAmenityObject {
  return {
    color: input.color,
    id: input.id,
    kind: "amenity",
    label: input.label,
    modelRole: input.modelRole,
    opacity: input.opacity,
    position: input.position,
    rotation: input.rotation,
    scale: input.scale,
    shape: input.shape,
  };
}
