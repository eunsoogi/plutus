import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BufferGeometry,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { AppLocale } from "./core";
import {
  officeThreeCameraPosition,
  pointOfficeThreeCameraAtTarget,
  serializeOfficeNumber,
  serializeOfficeVector,
} from "./orchestrator-office-three-camera";
import {
  normalizeOfficePitch,
  normalizeOfficeYaw,
} from "./orchestrator-office-canvas-geometry";
import {
  reduceOfficeCanvasPointerDrag,
  type OfficeCanvasDrag,
} from "./orchestrator-office-canvas-drag";
import type {
  OfficeCanvasScene,
  OfficeRotation,
} from "./orchestrator-office-canvas-types";
import type { TeamId } from "./orchestrator-office-teams";
import {
  createOfficeThreeRendererLifecycle,
  officeThreeRendererAdapter,
  type OfficeThreeAnimationFrameScheduler,
  type OfficeThreeRendererLifecycle,
} from "./orchestrator-office-three-renderer";
import { createOfficeThreeSceneCatalog } from "./orchestrator-office-three-scene";

type OfficeThreeViewLifecycle = OfficeThreeRendererLifecycle<
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Object3D,
  Mesh<BufferGeometry, Material>
>;

function officeThreeCanvasSize(canvas: HTMLCanvasElement): {
  readonly height: number;
  readonly width: number;
} {
  const bounds = canvas.getBoundingClientRect();
  return {
    height: Math.max(1, Math.round(bounds.height)),
    width: Math.max(1, Math.round(bounds.width)),
  };
}

function releasePointerCapture(
  canvas: HTMLCanvasElement,
  pointerId: number,
): void {
  if (canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
}

export function OrchestratorOfficeThreeView({
  locale = "en",
  onAngleDrag,
  rotation,
  scene,
  stage,
  teamId,
}: {
  readonly locale?: AppLocale;
  readonly onAngleDrag: (deltaX: number, deltaY: number) => void;
  readonly rotation: OfficeRotation;
  readonly scene: OfficeCanvasScene;
  readonly stage: string;
  readonly teamId?: TeamId;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<OfficeCanvasDrag | null>(null);
  const lifecycleRef = useRef<OfficeThreeViewLifecycle | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [renderCount, setRenderCount] = useState(0);
  const contract = useMemo(
    () => createOfficeThreeSceneCatalog({ locale, stage, teamId }),
    [locale, stage, teamId],
  );
  const animationFrame = useMemo(
    () =>
      ({
        cancel: (id) => window.cancelAnimationFrame(id),
        request: (callback) => window.requestAnimationFrame(callback),
      }) satisfies OfficeThreeAnimationFrameScheduler,
    [],
  );
  const cameraPosition = useMemo(
    () => officeThreeCameraPosition(scene.angle, scene.pitch),
    [scene.angle, scene.pitch],
  );
  const pitch = serializeOfficeNumber(normalizeOfficePitch(scene.pitch));
  const yaw = serializeOfficeNumber(normalizeOfficeYaw(scene.angle ?? 0));
  const camera = serializeOfficeVector(cameraPosition);
  const meshCount = contract.scene.objects.length.toString();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const lifecycle = createOfficeThreeRendererLifecycle({
      adapter: officeThreeRendererAdapter,
      animationFrame,
      canvas,
      contract,
      pixelRatio: Math.max(1, window.devicePixelRatio),
    });
    lifecycleRef.current = lifecycle;

    const resizeAndRender = () => {
      lifecycle.resize(officeThreeCanvasSize(canvas));
      lifecycle.render();
      setRenderCount((currentCount) => currentCount + 1);
    };

    resizeAndRender();
    lifecycle.start();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resizeAndRender);
      return () => {
        window.removeEventListener("resize", resizeAndRender);
        if (lifecycleRef.current === lifecycle) {
          lifecycleRef.current = null;
        }
        lifecycle.dispose();
      };
    }

    const observer = new ResizeObserver(resizeAndRender);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (lifecycleRef.current === lifecycle) {
        lifecycleRef.current = null;
      }
      lifecycle.dispose();
    };
  }, [animationFrame, contract]);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle === null) return;

    lifecycle.camera.position.set(
      cameraPosition[0],
      cameraPosition[1],
      cameraPosition[2],
    );
    pointOfficeThreeCameraAtTarget(lifecycle.camera);
    lifecycle.render();
    setRenderCount((currentCount) => currentCount + 1);
  }, [cameraPosition]);

  return (
    <canvas
      aria-hidden="true"
      className="orchestrator-office__canvas orchestrator-office__canvas--three"
      data-dragging={isDragging ? "true" : "false"}
      data-office-camera={camera}
      data-office-mesh-count={meshCount}
      data-office-pitch={pitch}
      data-office-render-count={renderCount.toString()}
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
