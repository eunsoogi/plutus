import type {
  OfficeThreeModelRole,
  OfficeThreeMotionMode,
  OfficeThreeRendererDiagnostics,
  OfficeThreeSceneObject,
  OfficeThreeVector3,
} from "./orchestrator-office-three-types";

const noRotation = [0, 0, 0] satisfies OfficeThreeVector3;
const idleSample = "0.000";

export type OfficeThreeMotionUpdate = {
  readonly position: OfficeThreeVector3;
  readonly rotation: OfficeThreeVector3;
  readonly sample: string;
};

export type OfficeThreeMotionRuntimeTarget<TMesh> = {
  readonly mesh: TMesh;
  readonly object: OfficeThreeSceneObject;
};

export type OfficeThreeMotionRuntimeInput<TMesh> = {
  readonly mode: OfficeThreeMotionMode;
  readonly onFrameDiagnostics?: (
    diagnostics: OfficeThreeRendererDiagnostics,
  ) => void;
  readonly setPosition: (mesh: TMesh, position: OfficeThreeVector3) => void;
  readonly setRotation: (mesh: TMesh, rotation: OfficeThreeVector3) => void;
  readonly targets: readonly OfficeThreeMotionRuntimeTarget<TMesh>[];
};

export type OfficeThreeMotionRuntime = {
  readonly apply: (time: number) => void;
  readonly getDiagnostics: () => OfficeThreeRendererDiagnostics;
};

function roleCanMove(role: OfficeThreeModelRole | undefined): boolean {
  switch (role) {
    case "agent-arm":
    case "agent-badge":
    case "agent-body":
    case "agent-foot":
    case "agent-head":
    case "agent-leg":
      return true;
    case undefined:
      return false;
    case "cabinet-body":
    case "cabinet-door":
    case "cabinet-handle":
    case "cabinet-panel":
    case "cabinet-shelf":
    case "chair-back":
    case "chair-leg":
    case "chair-seat":
    case "contact-pad":
    case "coffee-table-leg":
    case "coffee-table-top":
    case "desk-drawer":
    case "desk-edge":
    case "desk-equipment-cluster":
    case "desk-inset-panel":
    case "desk-leg":
    case "desk-lip":
    case "desk-surface":
    case "fixture-body":
    case "monitor-screen":
    case "monitor-stand":
    case "partition-panel":
    case "plant-leaf":
    case "planter-pot":
    case "report-bench-leg":
    case "report-bench-seat":
    case "rug-zone":
    case "sofa-arm":
    case "sofa-back":
    case "sofa-cushion":
    case "sofa-seat":
    case "terminal-panel":
    case "terminal-screen":
    case "wall-base-rail":
    case "wall-panel":
    case "wall-trim":
      return false;
  }
}

function phaseForId(id: string): number {
  return Array.from(id).reduce(
    (phase, character) => phase + character.charCodeAt(0),
    0,
  );
}

function phaseIdForObject(object: OfficeThreeSceneObject): string {
  if (object.kind === "agent") {
    return object.id;
  }

  if (!roleCanMove(object.modelRole)) {
    return object.id;
  }

  const idParts = object.id.split(":");
  const agentId = idParts[1];
  if (idParts[0] === "agent-detail" && agentId !== undefined) {
    return `agent:${agentId}`;
  }

  return object.id;
}

function motionAmplitude(object: OfficeThreeSceneObject): number {
  switch (object.modelRole) {
    case "agent-arm":
      return 0.11;
    case "agent-foot":
    case "agent-leg":
      return 0.025;
    case "agent-body":
    case "agent-badge":
    case "agent-head":
    case undefined:
      return object.kind === "agent" ? 0.035 : 0.018;
    default:
      return 0;
  }
}

export function officeThreeObjectCanMove(
  object: OfficeThreeSceneObject,
): boolean {
  return object.kind === "agent" || roleCanMove(object.modelRole);
}

export function officeThreeMotionUpdateFor(
  object: OfficeThreeSceneObject,
  time: number,
): OfficeThreeMotionUpdate {
  const phase = phaseForId(phaseIdForObject(object)) * 0.017;
  const wave = Math.sin(time * 0.006 + phase);
  const sway = Math.cos(time * 0.004 + phase);
  const amplitude = motionAmplitude(object);
  const baseRotation = object.rotation ?? noRotation;

  return {
    position: [
      object.position[0],
      object.position[1] + wave * amplitude,
      object.position[2],
    ],
    rotation: [
      baseRotation[0],
      baseRotation[1] + sway * amplitude * 0.7,
      baseRotation[2] + wave * amplitude,
    ],
    sample: (wave * amplitude).toFixed(3),
  };
}

export function idleOfficeThreeRendererDiagnostics(
  motionMode: OfficeThreeRendererDiagnostics["motionMode"],
): OfficeThreeRendererDiagnostics {
  return {
    motionFrame: 0,
    motionMode,
    motionSample: idleSample,
  };
}

export function createOfficeThreeMotionRuntime<TMesh>(
  input: OfficeThreeMotionRuntimeInput<TMesh>,
): OfficeThreeMotionRuntime {
  let diagnostics = idleOfficeThreeRendererDiagnostics(input.mode);
  let motionFrame = 0;

  function publish(nextDiagnostics: OfficeThreeRendererDiagnostics): void {
    diagnostics = nextDiagnostics;
    input.onFrameDiagnostics?.(nextDiagnostics);
  }

  function apply(time: number): void {
    if (input.mode === "idle") {
      publish(idleOfficeThreeRendererDiagnostics("idle"));
      return;
    }

    motionFrame += 1;
    let motionSample = idleSample;
    let motionSampleObjectId: string | undefined;
    for (const target of input.targets) {
      const update = officeThreeMotionUpdateFor(target.object, time);
      input.setPosition(target.mesh, update.position);
      input.setRotation(target.mesh, update.rotation);
      motionSampleObjectId ??= target.object.id;
      if (target.object.id === motionSampleObjectId) {
        motionSample = update.sample;
      }
    }
    publish({
      motionFrame,
      motionMode: "active",
      motionSample,
      motionSampleObjectId,
    });
  }

  return {
    apply,
    getDiagnostics: () => diagnostics,
  };
}
