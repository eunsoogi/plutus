import { describe, expect, it } from "vitest";
import { reduceOfficeCanvasPointerDrag } from "./orchestrator-office-canvas-drag";

describe("orchestrator office canvas drag state", () => {
  it("keeps the active pointer in control until the matching pointer ends", () => {
    const primaryDrag = reduceOfficeCanvasPointerDrag(null, {
      clientX: 120,
      clientY: 200,
      isPrimary: true,
      kind: "pointerdown",
      pointerId: 1,
    });

    expect(primaryDrag).toMatchObject({
      deltaX: null,
      deltaY: null,
      nextDrag: { pointerId: 1, x: 120, y: 200 },
      shouldCapture: true,
      shouldRelease: false,
    });

    const ignoredSecondaryStart = reduceOfficeCanvasPointerDrag(
      primaryDrag.nextDrag,
      {
        clientX: 300,
        clientY: 250,
        isPrimary: false,
        kind: "pointerdown",
        pointerId: 2,
      },
    );

    expect(ignoredSecondaryStart).toMatchObject({
      deltaX: null,
      deltaY: null,
      nextDrag: { pointerId: 1, x: 120, y: 200 },
      shouldCapture: false,
      shouldRelease: false,
    });

    const ignoredSecondaryMove = reduceOfficeCanvasPointerDrag(
      ignoredSecondaryStart.nextDrag,
      {
        clientX: 336,
        clientY: 300,
        isPrimary: false,
        kind: "pointermove",
        pointerId: 2,
      },
    );

    expect(ignoredSecondaryMove).toMatchObject({
      deltaX: null,
      deltaY: null,
      nextDrag: { pointerId: 1, x: 120, y: 200 },
      shouldCapture: false,
      shouldRelease: false,
    });

    const ignoredSecondaryEnd = reduceOfficeCanvasPointerDrag(
      ignoredSecondaryMove.nextDrag,
      {
        clientX: 336,
        clientY: 300,
        kind: "pointerup",
        pointerId: 2,
      },
    );

    expect(ignoredSecondaryEnd).toMatchObject({
      deltaX: null,
      deltaY: null,
      nextDrag: { pointerId: 1, x: 120, y: 200 },
      shouldCapture: false,
      shouldRelease: false,
    });

    const primaryMove = reduceOfficeCanvasPointerDrag(
      ignoredSecondaryEnd.nextDrag,
      {
        clientX: 168,
        clientY: 170,
        isPrimary: true,
        kind: "pointermove",
        pointerId: 1,
      },
    );

    expect(primaryMove).toMatchObject({
      deltaX: 48,
      deltaY: -30,
      nextDrag: { pointerId: 1, x: 168, y: 170 },
      shouldCapture: false,
      shouldRelease: false,
    });

    const primaryEnd = reduceOfficeCanvasPointerDrag(primaryMove.nextDrag, {
      clientX: 168,
      clientY: 170,
      kind: "pointercancel",
      pointerId: 1,
    });

    expect(primaryEnd).toMatchObject({
      deltaX: null,
      deltaY: null,
      nextDrag: null,
      shouldCapture: false,
      shouldRelease: true,
    });
  });

  it("tracks diagonal pointer movement on both axes", () => {
    const startedDrag = reduceOfficeCanvasPointerDrag(null, {
      clientX: 100,
      clientY: 100,
      isPrimary: true,
      kind: "pointerdown",
      pointerId: 7,
    });

    const movedDrag = reduceOfficeCanvasPointerDrag(startedDrag.nextDrag, {
      clientX: 130,
      clientY: 70,
      isPrimary: true,
      kind: "pointermove",
      pointerId: 7,
    });

    expect(movedDrag).toMatchObject({
      deltaX: 30,
      deltaY: -30,
      nextDrag: { pointerId: 7, x: 130, y: 70 },
      shouldCapture: false,
      shouldRelease: false,
    });
  });
});
