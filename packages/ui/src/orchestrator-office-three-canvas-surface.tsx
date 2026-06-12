import { useRef, useState, type RefObject } from "react";
import {
  reduceOfficeCanvasPointerDrag,
  type OfficeCanvasDrag,
} from "./orchestrator-office-canvas-drag";
import type { OfficeRotation } from "./orchestrator-office-canvas-types";

type OfficeThreeCanvasSurfaceProps = {
  readonly camera: string;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly meshCount: string;
  readonly modelSource: string;
  readonly motionMode: "active" | "idle";
  readonly onAngleDrag: (deltaX: number, deltaY: number) => void;
  readonly pitch: string;
  readonly renderCount: string;
  readonly rotation: OfficeRotation;
  readonly yaw: string;
};

function releasePointerCapture(
  canvas: HTMLCanvasElement,
  pointerId: number,
): void {
  if (canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
}

export function OrchestratorOfficeThreeCanvasSurface({
  camera,
  canvasRef,
  meshCount,
  modelSource,
  motionMode,
  onAngleDrag,
  pitch,
  renderCount,
  rotation,
  yaw,
}: OfficeThreeCanvasSurfaceProps) {
  const dragRef = useRef<OfficeCanvasDrag | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <canvas
      aria-hidden="true"
      className="orchestrator-office__canvas orchestrator-office__canvas--three"
      data-dragging={isDragging ? "true" : "false"}
      data-office-camera={camera}
      data-office-mesh-count={meshCount}
      data-office-model-source={modelSource}
      data-office-motion-frame="0"
      data-office-motion-mode={motionMode}
      data-office-motion-sample="0.000"
      data-office-pitch={pitch}
      data-office-render-count={renderCount}
      data-office-renderer="three"
      data-office-rotation={rotation}
      data-office-yaw={yaw}
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
