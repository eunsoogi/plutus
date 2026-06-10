import { describe, expect, it } from "vitest";
import { officeThreeCameraPosition } from "./orchestrator-office-three-camera";
import { createOfficeThreeRendererContract } from "./orchestrator-office-three-types";
import {
  fakeOfficeThreeAdapter,
  fakeScheduler,
  sceneObjects,
} from "./orchestrator-office-three-renderer-test-support";
import {
  applyOfficeThreeLifecycleCamera,
  createOfficeThreeViewLifecycle,
  shouldStartOfficeThreeAnimationLoop,
  type OfficeThreeCameraLifecycle,
} from "./orchestrator-office-three-view";

describe("office Three.js view camera sync", () => {
  it("starts the continuous animation loop only for active motion", () => {
    expect(shouldStartOfficeThreeAnimationLoop("active")).toBe(true);
    expect(shouldStartOfficeThreeAnimationLoop("idle")).toBe(false);
  });

  it("applies the current dragged camera position to a recreated lifecycle", () => {
    const positionCalls: [number, number, number][] = [];
    const lookAtCalls: [number, number, number][] = [];
    const lifecycle = {
      camera: {
        lookAt: (x, y, z) => lookAtCalls.push([x, y, z]),
        position: {
          set: (x, y, z) => positionCalls.push([x, y, z]),
        },
      },
    } satisfies OfficeThreeCameraLifecycle;
    const draggedCameraPosition = officeThreeCameraPosition(101.5, 55.2);

    applyOfficeThreeLifecycleCamera(lifecycle, draggedCameraPosition);

    expect(positionCalls).toEqual([draggedCameraPosition]);
    expect(lookAtCalls).toEqual([[0, 0.18, 0]]);
  });

  it("uses a closer default camera while keeping dragged framing outside the model", () => {
    const defaultCameraPosition = officeThreeCameraPosition(undefined, undefined);
    const draggedCameraPosition = officeThreeCameraPosition(71.48, 53.24);
    const defaultHorizontalDistance = Math.hypot(
      defaultCameraPosition[0],
      defaultCameraPosition[2],
    );
    const draggedHorizontalDistance = Math.hypot(
      draggedCameraPosition[0],
      draggedCameraPosition[2],
    );

    expect(defaultCameraPosition[1]).toBeLessThan(6.5);
    expect(defaultHorizontalDistance).toBeGreaterThan(6.6);
    expect(draggedCameraPosition[1]).toBeLessThan(7.5);
    expect(draggedHorizontalDistance).toBeGreaterThan(5.3);
  });

  it("reports renderer creation failure without throwing from the view guard", () => {
    const { adapter } = fakeOfficeThreeAdapter();
    const result = createOfficeThreeViewLifecycle({
      adapter: {
        ...adapter,
        createRenderer: () => {
          throw new Error("WebGL unavailable");
        },
      },
      animationFrame: fakeScheduler(),
      canvas: { clientHeight: 300, clientWidth: 600, height: 0, width: 0 },
      contract: createOfficeThreeRendererContract({
        scene: {
          objects: sceneObjects,
        },
      }),
    });

    expect(result).toMatchObject({
      kind: "unavailable",
    });
  });
});
