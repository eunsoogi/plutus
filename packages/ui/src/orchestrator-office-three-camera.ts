import {
  normalizeOfficePitch,
  normalizeOfficeYaw,
} from "./orchestrator-office-canvas-geometry";
import type { OfficeThreeVector3 } from "./orchestrator-office-three-types";

const officeThreeCameraTarget = [0, 0.42, 0] satisfies OfficeThreeVector3;
const officeThreeCameraRadius = 8.9;
const officeThreeInitialYawRadians = Math.atan2(5.6, 6.4);

function roundedOfficeNumber(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function serializeOfficeNumber(value: number): string {
  return roundedOfficeNumber(value).toString();
}

export function serializeOfficeVector(vector: OfficeThreeVector3): string {
  return vector.map((value) => serializeOfficeNumber(value)).join(",");
}

export function officeThreeCameraPosition(
  angle: number | undefined,
  pitch: number | undefined,
): OfficeThreeVector3 {
  const yawRadians =
    officeThreeInitialYawRadians +
    (normalizeOfficeYaw(angle ?? 0) * Math.PI) / 180;
  const pitchRadians = (normalizeOfficePitch(pitch) * Math.PI) / 180;
  const horizontalRadius = Math.cos(pitchRadians) * officeThreeCameraRadius;

  return [
    Math.sin(yawRadians) * horizontalRadius,
    officeThreeCameraTarget[1] +
      Math.sin(pitchRadians) * officeThreeCameraRadius,
    Math.cos(yawRadians) * horizontalRadius,
  ];
}

export function pointOfficeThreeCameraAtTarget(camera: {
  readonly lookAt: (x: number, y: number, z: number) => void;
}): void {
  camera.lookAt(
    officeThreeCameraTarget[0],
    officeThreeCameraTarget[1],
    officeThreeCameraTarget[2],
  );
}
