import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_OFFICE_PITCH } from "./orchestrator-office-canvas-geometry";
import { buildOfficeDrawCommands } from "./orchestrator-office-canvas-layout";
import {
  reduceOfficeCanvasPointerDrag,
  type OfficeCanvasDrag,
} from "./orchestrator-office-canvas-drag";
import { renderOfficeCanvas } from "./orchestrator-office-canvas-renderer";
import type { OfficeCanvasScene } from "./orchestrator-office-canvas-types";

function serializeOfficeYaw(angle: number | undefined): string {
  const safeAngle =
    typeof angle === "number" && Number.isFinite(angle) ? angle : 0;
  const roundedAngle = Math.round(safeAngle * 100) / 100;

  if (Object.is(roundedAngle, -0) || roundedAngle === 0) {
    return "0";
  }

  return roundedAngle.toString();
}

function serializeOfficePitch(pitch: number | undefined): string {
  const safePitch =
    typeof pitch === "number" && Number.isFinite(pitch)
      ? pitch
      : DEFAULT_OFFICE_PITCH;
  return (Math.round(safePitch * 100) / 100).toString();
}

export function OrchestratorOfficeCanvas({
  onAngleDrag,
  scene,
}: {
  readonly onAngleDrag: (deltaX: number, deltaY: number) => void;
  readonly scene: OfficeCanvasScene;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<OfficeCanvasDrag | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const commands = useMemo(() => buildOfficeDrawCommands(scene), [scene]);
  const pitch = serializeOfficePitch(scene.pitch);
  const yaw = serializeOfficeYaw(scene.angle);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const viewport = {
        height: Math.max(1, bounds.height),
        width: Math.max(1, bounds.width),
      };
      const pixelRatio = Math.max(1, window.devicePixelRatio);
      canvas.height = Math.round(viewport.height * pixelRatio);
      canvas.width = Math.round(viewport.width * pixelRatio);

      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      renderOfficeCanvas(context, commands, viewport);
    };

    draw();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", draw);
      return () => window.removeEventListener("resize", draw);
    }

    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [commands]);

  const releasePointerCapture = (
    canvas: HTMLCanvasElement,
    pointerId: number,
  ) => {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  };

  return (
    <canvas
      aria-hidden="true"
      className="orchestrator-office__canvas"
      data-office-pitch={pitch}
      data-office-rotation={scene.rotation}
      data-office-yaw={yaw}
      data-dragging={isDragging ? "true" : "false"}
      data-testid="orchestrator-office-canvas"
      onPointerCancel={(event) => {
        const transition = reduceOfficeCanvasPointerDrag(dragRef.current, {
          clientX: event.clientX,
          clientY: event.clientY,
          kind: "pointercancel",
          pointerId: event.pointerId,
        });

        dragRef.current = transition.nextDrag;
        setIsDragging(transition.nextDrag !== null);

        if (transition.shouldRelease) {
          releasePointerCapture(event.currentTarget, event.pointerId);
        }
      }}
      onPointerDown={(event) => {
        const transition = reduceOfficeCanvasPointerDrag(dragRef.current, {
          clientX: event.clientX,
          clientY: event.clientY,
          isPrimary: event.isPrimary,
          kind: "pointerdown",
          pointerId: event.pointerId,
        });

        dragRef.current = transition.nextDrag;
        setIsDragging(transition.nextDrag !== null);

        if (transition.shouldCapture) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        const transition = reduceOfficeCanvasPointerDrag(dragRef.current, {
          clientX: event.clientX,
          clientY: event.clientY,
          isPrimary: event.isPrimary,
          kind: "pointermove",
          pointerId: event.pointerId,
        });

        dragRef.current = transition.nextDrag;

        if (transition.deltaX === null || transition.deltaY === null) {
          return;
        }

        onAngleDrag(transition.deltaX, transition.deltaY);
      }}
      onPointerUp={(event) => {
        const transition = reduceOfficeCanvasPointerDrag(dragRef.current, {
          clientX: event.clientX,
          clientY: event.clientY,
          kind: "pointerup",
          pointerId: event.pointerId,
        });

        dragRef.current = transition.nextDrag;
        setIsDragging(transition.nextDrag !== null);

        if (transition.shouldRelease) {
          releasePointerCapture(event.currentTarget, event.pointerId);
        }
      }}
      ref={canvasRef}
    />
  );
}
