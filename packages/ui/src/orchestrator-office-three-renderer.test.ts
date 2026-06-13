import { describe, expect, it, vi } from "vitest";
import { createOfficeThreeRendererContract } from "./orchestrator-office-three-types";
import type { OfficeThreeSceneObject } from "./orchestrator-office-three-types";
import { officeThreeMotionUpdateFor } from "./orchestrator-office-three-motion";
import { createOfficeThreeRendererLifecycle } from "./orchestrator-office-three-renderer";
import {
  fakeOfficeThreeAdapter,
  fakeScheduler,
  sceneObjects,
} from "./orchestrator-office-three-renderer-test-support";

function officeContract() {
  return createOfficeThreeRendererContract({
    scene: {
      background: "#10100d",
      objects: sceneObjects,
    },
  });
}

function officeContractWithMotion(mode: "active" | "idle") {
  return createOfficeThreeRendererContract({
    scene: {
      background: "#10100d",
      motion: { mode },
      objects: sceneObjects,
    },
  });
}

function normalizedBob(
  object: OfficeThreeSceneObject,
  time: number,
  amplitude: number,
): number {
  return (
    (officeThreeMotionUpdateFor(object, time).position[1] -
      object.position[1]) /
    amplitude
  );
}

describe("office Three.js renderer lifecycle", () => {
  it("constructs the renderer scene, camera, lights, and object meshes", () => {
    const { adapter, renderer } = fakeOfficeThreeAdapter();
    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter,
      animationFrame: fakeScheduler(),
      canvas: { clientHeight: 540, clientWidth: 960, height: 0, width: 0 },
      contract: officeContract(),
      pixelRatio: 2,
    });

    expect(renderer.setPixelRatios).toEqual([2]);
    expect(renderer.sizes).toEqual([
      { height: 540, updateStyle: false, width: 960 },
    ]);
    expect(lifecycle.scene.background).toBe("#10100d");
    expect(lifecycle.camera.aspect).toBeCloseTo(16 / 9);
    expect(lifecycle.root.children.map((child) => child.kind)).toEqual([
      "mesh",
      "mesh",
      "mesh",
    ]);
    expect(lifecycle.scene.children.map((child) => child.kind)).toEqual([
      "root",
      "ambientLight",
      "directionalLight",
    ]);
    expect(lifecycle.meshesByObjectId.get("desk:command")?.scale.calls).toEqual(
      [[1.8, 0.4, 0.9]],
    );
  });

  it("uses shaped geometry for recognizable office detail meshes", () => {
    const { adapter } = fakeOfficeThreeAdapter();
    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter,
      animationFrame: fakeScheduler(),
      canvas: { clientHeight: 540, clientWidth: 960, height: 0, width: 0 },
      contract: officeContract(),
    });

    expect(lifecycle.meshesByObjectId.get("desk:command")?.geometry.kind).toBe(
      "box",
    );
    expect(
      lifecycle.meshesByObjectId.get("detail:monitor-stand")?.geometry.kind,
    ).toBe("cylinder");
  });

  it("renders downloaded Kenney assets as transparent plane textures", () => {
    const spriteObject = {
      assetImageUrl: "/assets/kenney-furniture-kit/isometric/desk_SE.png",
      color: "#ffffff",
      id: "kenney-real:desk",
      kind: "amenity",
      label: "Kenney desk sprite",
      modelRole: "kenney-desk",
      position: [0, 1, 0],
      scale: [1.8, 1.2, 1],
      shape: "plane",
    } satisfies OfficeThreeSceneObject;
    const { adapter } = fakeOfficeThreeAdapter();
    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter,
      animationFrame: fakeScheduler(),
      canvas: { clientHeight: 540, clientWidth: 960, height: 0, width: 0 },
      contract: createOfficeThreeRendererContract({
        scene: {
          background: "#10100d",
          objects: [spriteObject],
        },
      }),
    });
    const spriteMesh = lifecycle.meshesByObjectId.get("kenney-real:desk");

    expect(spriteMesh?.geometry.kind).toBe("plane");
    expect(spriteMesh?.material.assetImageUrl).toBe(
      "/assets/kenney-furniture-kit/isometric/desk_SE.png",
    );
  });

  it("resizes without mutating canvas styles and renders the current scene", () => {
    const { adapter, renderer } = fakeOfficeThreeAdapter();
    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter,
      animationFrame: fakeScheduler(),
      canvas: { clientHeight: 300, clientWidth: 600, height: 0, width: 0 },
      contract: officeContract(),
    });

    lifecycle.resize({ height: 720, width: 1280 });
    lifecycle.render();

    expect(renderer.sizes).toEqual([
      { height: 300, updateStyle: false, width: 600 },
      { height: 720, updateStyle: false, width: 1280 },
    ]);
    expect(lifecycle.camera.aspect).toBeCloseTo(16 / 9);
    expect(lifecycle.camera.projectionUpdates).toBe(2);
    expect(renderer.renders).toEqual([[lifecycle.scene, lifecycle.camera]]);
  });

  it("starts one render loop and cancels it during cleanup", () => {
    const { adapter, renderer } = fakeOfficeThreeAdapter();
    const scheduler = fakeScheduler();
    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter,
      animationFrame: scheduler,
      canvas: { clientHeight: 360, clientWidth: 640, height: 0, width: 0 },
      contract: officeContract(),
    });

    lifecycle.start();
    lifecycle.start();
    scheduler.queued[0]?.callback(16);
    lifecycle.dispose();

    expect(scheduler.queued).toHaveLength(2);
    expect(renderer.renders).toHaveLength(1);
    expect(scheduler.canceled).toEqual([2]);
    expect(renderer.disposed).toEqual(["renderer"]);
  });

  it("animates agent mesh transforms during active motion frames", () => {
    const { adapter } = fakeOfficeThreeAdapter();
    const scheduler = fakeScheduler();
    const diagnostics = vi.fn();
    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter,
      animationFrame: scheduler,
      canvas: { clientHeight: 360, clientWidth: 640, height: 0, width: 0 },
      contract: officeContractWithMotion("active"),
      onFrameDiagnostics: diagnostics,
    });

    lifecycle.start();
    scheduler.queued[0]?.callback(160);
    scheduler.queued[1]?.callback(320);

    const agent = lifecycle.meshesByObjectId.get("agent:orchestrator");
    expect(agent?.position.calls).not.toEqual([[0, 0.8, 0]]);
    expect(lifecycle.getDiagnostics()).toMatchObject({
      motionFrame: 2,
      motionMode: "active",
      motionSampleObjectId: "agent:orchestrator",
    });
    expect(diagnostics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        motionFrame: 2,
        motionMode: "active",
      }),
    );
  });

  it("keeps composite agent parts on one shared motion phase", () => {
    const time = 640;
    const agentHead = {
      color: "#f2c9a7",
      id: "agent:orchestrator",
      kind: "agent",
      label: "Research Orchestrator",
      modelRole: "agent-head",
      position: [0, 0.8, 0],
      radius: 0.32,
      shape: "sphere",
    } satisfies OfficeThreeSceneObject;
    const agentBody = {
      color: "#64d1c8",
      id: "agent-detail:orchestrator:body",
      kind: "amenity",
      label: "Research Orchestrator body",
      modelRole: "agent-body",
      position: [0, 0.24, 0],
      scale: [0.42, 0.44, 0.27],
      shape: "cylinder",
    } satisfies OfficeThreeSceneObject;
    const agentBadge = {
      color: "#f8fafc",
      id: "agent-detail:orchestrator:badge",
      kind: "amenity",
      label: "Research Orchestrator badge",
      modelRole: "agent-badge",
      position: [0, 0.28, 0.13],
      scale: [0.13, 0.12, 0.02],
    } satisfies OfficeThreeSceneObject;

    const headBob = normalizedBob(agentHead, time, 0.035);

    expect(normalizedBob(agentBody, time, 0.018)).toBeCloseTo(headBob);
    expect(normalizedBob(agentBadge, time, 0.018)).toBeCloseTo(headBob);
  });

  it("keeps agent mesh transforms stable during idle motion frames", () => {
    const { adapter } = fakeOfficeThreeAdapter();
    const scheduler = fakeScheduler();
    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter,
      animationFrame: scheduler,
      canvas: { clientHeight: 360, clientWidth: 640, height: 0, width: 0 },
      contract: officeContractWithMotion("idle"),
    });

    lifecycle.start();
    scheduler.queued[0]?.callback(160);
    scheduler.queued[1]?.callback(320);

    expect(
      lifecycle.meshesByObjectId.get("agent:orchestrator")?.position.calls,
    ).toEqual([[0, 0.8, 0]]);
    expect(lifecycle.getDiagnostics()).toMatchObject({
      motionFrame: 0,
      motionMode: "idle",
      motionSample: "0.000",
    });
  });

  it("disposes created mesh resources exactly once", () => {
    const { adapter, geometries, materials } = fakeOfficeThreeAdapter();
    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter,
      animationFrame: fakeScheduler(),
      canvas: { clientHeight: 400, clientWidth: 800, height: 0, width: 0 },
      contract: officeContract(),
    });

    lifecycle.dispose();
    lifecycle.dispose();

    expect(geometries.map((geometry) => geometry.disposed)).toEqual([
      ["sphere:0.32"],
      ["box"],
      ["cylinder"],
    ]);
    expect(materials.map((material) => material.disposed)).toEqual([
      ["#2563eb"],
      ["#d6bc8b"],
      ["#334155"],
    ]);
  });
});
