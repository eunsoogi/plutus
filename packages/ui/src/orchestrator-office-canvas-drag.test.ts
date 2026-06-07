import { describe, expect, it } from "vitest";
import { reduceOfficeCanvasPointerDrag } from "./orchestrator-office-canvas-drag";

describe("orchestrator office canvas drag state", () => {
  it("keeps the active pointer in control until the matching pointer ends", () => {
    const primaryDrag = reduceOfficeCanvasPointerDrag(null, {
      clientX: 120,
      isPrimary: true,
      kind: "pointerdown",
      pointerId: 1,
    });

    expect(primaryDrag).toMatchObject({
      deltaX: null,
      nextDrag: { pointerId: 1, x: 120 },
      shouldCapture: true,
      shouldRelease: false,
    });

    const ignoredSecondaryStart = reduceOfficeCanvasPointerDrag(
      primaryDrag.nextDrag,
      {
        clientX: 300,
        isPrimary: false,
        kind: "pointerdown",
        pointerId: 2,
      },
    );

    expect(ignoredSecondaryStart).toMatchObject({
      deltaX: null,
      nextDrag: { pointerId: 1, x: 120 },
      shouldCapture: false,
      shouldRelease: false,
    });

    const ignoredSecondaryMove = reduceOfficeCanvasPointerDrag(
      ignoredSecondaryStart.nextDrag,
      {
        clientX: 336,
        isPrimary: false,
        kind: "pointermove",
        pointerId: 2,
      },
    );

    expect(ignoredSecondaryMove).toMatchObject({
      deltaX: null,
      nextDrag: { pointerId: 1, x: 120 },
      shouldCapture: false,
      shouldRelease: false,
    });

    const ignoredSecondaryEnd = reduceOfficeCanvasPointerDrag(
      ignoredSecondaryMove.nextDrag,
      {
        clientX: 336,
        kind: "pointerup",
        pointerId: 2,
      },
    );

    expect(ignoredSecondaryEnd).toMatchObject({
      deltaX: null,
      nextDrag: { pointerId: 1, x: 120 },
      shouldCapture: false,
      shouldRelease: false,
    });

    const primaryMove = reduceOfficeCanvasPointerDrag(
      ignoredSecondaryEnd.nextDrag,
      {
        clientX: 168,
        isPrimary: true,
        kind: "pointermove",
        pointerId: 1,
      },
    );

    expect(primaryMove).toMatchObject({
      deltaX: 48,
      nextDrag: { pointerId: 1, x: 168 },
      shouldCapture: false,
      shouldRelease: false,
    });

    const primaryEnd = reduceOfficeCanvasPointerDrag(primaryMove.nextDrag, {
      clientX: 168,
      kind: "pointercancel",
      pointerId: 1,
    });

    expect(primaryEnd).toMatchObject({
      deltaX: null,
      nextDrag: null,
      shouldCapture: false,
      shouldRelease: true,
    });
  });
});
