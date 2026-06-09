import { describe, expect, it } from "vitest";
import { createOfficeThreeRendererContract } from "./orchestrator-office-three-types";
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
