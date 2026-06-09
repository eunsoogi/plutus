import { Mesh, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { describe, expect, it } from "vitest";
import {
  createOfficeThreeRendererContract,
  officeThreeCameraDefaults,
  officeThreeInteractionDefaults,
  officeThreeRendererContractVersion,
  type OfficeThreeCameraState,
  type OfficeThreeInteractionState,
  type OfficeThreeSceneObject,
} from "./orchestrator-office-three-types";

describe("office Three.js renderer contract", () => {
  it("resolves Three.js runtime imports without constructing WebGL", () => {
    expect(Scene).toBeTypeOf("function");
    expect(PerspectiveCamera).toBeTypeOf("function");
    expect(Mesh).toBeTypeOf("function");
    expect(WebGLRenderer).toBeTypeOf("function");
    expect(OrbitControls).toBeTypeOf("function");
  });

  it("defines readonly scene objects, camera state, and interaction state", () => {
    const objects = [
      {
        color: "#2563eb",
        id: "agent:orchestrator",
        kind: "agent",
        label: "Orchestrator",
        position: [0, 0.82, 0],
        radius: 0.32,
      },
      {
        color: "#d6bc8b",
        id: "desk:command",
        kind: "desk",
        label: "Command desk",
        position: [0, 0.4, 0.72],
        scale: [1.8, 0.72, 0.88],
      },
    ] satisfies readonly OfficeThreeSceneObject[];

    const camera = {
      ...officeThreeCameraDefaults,
      position: [5.8, 4.6, 6.2],
      target: [0, 0.4, 0],
    } satisfies OfficeThreeCameraState;

    const interaction = {
      ...officeThreeInteractionDefaults,
      selectedObjectId: "agent:orchestrator",
    } satisfies OfficeThreeInteractionState;

    const contract = createOfficeThreeRendererContract({
      camera,
      interaction,
      scene: { objects },
    });

    expect(contract.version).toBe(officeThreeRendererContractVersion);
    expect(contract.scene.objects.map((object) => object.id)).toEqual([
      "agent:orchestrator",
      "desk:command",
    ]);
    expect(contract.camera.target).toEqual([0, 0.4, 0]);
    expect(contract.interaction.controls.enableDamping).toBe(true);
    expect(contract.interaction.selectedObjectId).toBe("agent:orchestrator");
  });
});
