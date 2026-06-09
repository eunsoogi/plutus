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
  type OfficeThreeCameraLifecycle,
} from "./orchestrator-office-three-view";

describe("office Three.js view camera sync", () => {
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
    expect(lookAtCalls).toEqual([[0, 0.42, 0]]);
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
