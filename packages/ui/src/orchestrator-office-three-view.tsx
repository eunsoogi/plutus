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
import { OrchestratorOfficeCanvas } from "./orchestrator-office-canvas";
import type {
  OfficeCanvasScene,
  OfficeRotation,
} from "./orchestrator-office-canvas-types";
import type { TeamId } from "./orchestrator-office-teams";
import {
  createOfficeThreeRendererLifecycle,
  officeThreeRendererAdapter,
  type OfficeThreeAnimationFrameScheduler,
  type OfficeThreeRendererCanvas,
  type OfficeThreeRendererLifecycle,
  type OfficeThreeRendererLifecycleInput,
} from "./orchestrator-office-three-renderer";
import { createOfficeThreeSceneCatalog } from "./orchestrator-office-three-scene";
import type { OfficeThreeVector3 } from "./orchestrator-office-three-types";

type OfficeThreeViewLifecycle = OfficeThreeRendererLifecycle<
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Object3D,
  Mesh<BufferGeometry, Material>
>;

export type OfficeThreeLifecycleCreationResult<TLifecycle> =
  | {
      readonly kind: "ready";
      readonly lifecycle: TLifecycle;
    }
  | {
      readonly error: unknown;
      readonly kind: "unavailable";
    };

export type OfficeThreeCameraLifecycle = {
  readonly camera: {
    readonly lookAt: (x: number, y: number, z: number) => void;
    readonly position: {
      readonly set: (x: number, y: number, z: number) => void;
    };
  };
};

export function createOfficeThreeViewLifecycle<
  TCanvas extends OfficeThreeRendererCanvas,
  TRenderer,
  TScene,
  TCamera,
  TNode,
  TMesh extends TNode,
  TGeometry,
  TMaterial,
  TBackground,
>(
  input: OfficeThreeRendererLifecycleInput<
    TCanvas,
    TRenderer,
    TScene,
    TCamera,
    TNode,
    TMesh,
    TGeometry,
    TMaterial,
    TBackground
  >,
  createLifecycle: (
    lifecycleInput: OfficeThreeRendererLifecycleInput<
      TCanvas,
      TRenderer,
      TScene,
      TCamera,
      TNode,
      TMesh,
      TGeometry,
      TMaterial,
      TBackground
    >,
  ) => OfficeThreeRendererLifecycle<
    TRenderer,
    TScene,
    TCamera,
    TNode,
    TMesh
  > = createOfficeThreeRendererLifecycle,
): OfficeThreeLifecycleCreationResult<
  OfficeThreeRendererLifecycle<TRenderer, TScene, TCamera, TNode, TMesh>
> {
  try {
    return {
      kind: "ready",
      lifecycle: createLifecycle(input),
    };
  } catch (error) {
    return {
      error,
      kind: "unavailable",
    };
  }
}

export function applyOfficeThreeLifecycleCamera(
  lifecycle: OfficeThreeCameraLifecycle,
  cameraPosition: OfficeThreeVector3,
): void {
  lifecycle.camera.position.set(
    cameraPosition[0],
    cameraPosition[1],
    cameraPosition[2],
  );
  pointOfficeThreeCameraAtTarget(lifecycle.camera);
}

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

function canCreateOfficeThreeWebGLContext(canvas: HTMLCanvasElement): boolean {
  const contextAttributes = {
    antialias: true,
    preserveDrawingBuffer: true,
  } satisfies WebGLContextAttributes;

  try {
    return (
      canvas.getContext("webgl2", contextAttributes) !== null ||
      canvas.getContext("webgl", contextAttributes) !== null
    );
  } catch {
    return false;
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
  const [rendererMode, setRendererMode] = useState<"canvas" | "three">("three");
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
  const cameraPositionRef = useRef(cameraPosition);
  cameraPositionRef.current = cameraPosition;
  const pitch = serializeOfficeNumber(normalizeOfficePitch(scene.pitch));
  const yaw = serializeOfficeNumber(normalizeOfficeYaw(scene.angle ?? 0));
  const camera = serializeOfficeVector(cameraPosition);
  const meshCount = contract.scene.objects.length.toString();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    if (!canCreateOfficeThreeWebGLContext(canvas)) {
      lifecycleRef.current = null;
      setRendererMode("canvas");
      return;
    }

    const lifecycleResult = createOfficeThreeViewLifecycle({
      adapter: officeThreeRendererAdapter,
      animationFrame,
      canvas,
      contract,
      pixelRatio: Math.max(1, window.devicePixelRatio),
    });
    if (lifecycleResult.kind === "unavailable") {
      lifecycleRef.current = null;
      setRendererMode("canvas");
      return;
    }

    const lifecycle = lifecycleResult.lifecycle;
    setRendererMode("three");
    lifecycleRef.current = lifecycle;
    applyOfficeThreeLifecycleCamera(lifecycle, cameraPositionRef.current);

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

    applyOfficeThreeLifecycleCamera(lifecycle, cameraPosition);
    lifecycle.render();
    setRenderCount((currentCount) => currentCount + 1);
  }, [cameraPosition]);

  if (rendererMode === "canvas") {
    return <OrchestratorOfficeCanvas onAngleDrag={onAngleDrag} scene={scene} />;
  }

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
