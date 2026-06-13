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
import { OrchestratorOfficeCanvas } from "./orchestrator-office-canvas";
import type {
  OfficeCanvasScene,
  OfficeRotation,
} from "./orchestrator-office-canvas-types";
import type { TeamId } from "./orchestrator-office-teams";
import {
  officeThreeRendererAdapter,
  type OfficeThreeAnimationFrameScheduler,
  type OfficeThreeRendererLifecycle,
} from "./orchestrator-office-three-renderer";
import { createOfficeThreeSceneCatalog } from "./orchestrator-office-three-scene";
import { writeOfficeThreeCanvasDiagnostics } from "./orchestrator-office-three-diagnostics";
import { OrchestratorOfficeThreeCanvasSurface } from "./orchestrator-office-three-canvas-surface";
import {
  canCreateOfficeThreeWebGLContext,
  officeThreeCanvasSize,
} from "./orchestrator-office-three-webgl";
import { createOfficeThreeViewLifecycle } from "./orchestrator-office-three-view-lifecycle";
import type {
  OfficeThreeMotionMode,
  OfficeThreeVector3,
} from "./orchestrator-office-three-types";

type OfficeThreeViewLifecycle = OfficeThreeRendererLifecycle<
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Object3D,
  Mesh<BufferGeometry, Material>
>;

export { createOfficeThreeViewLifecycle } from "./orchestrator-office-three-view-lifecycle";

export type OfficeThreeCameraLifecycle = {
  readonly camera: {
    readonly lookAt: (x: number, y: number, z: number) => void;
    readonly position: {
      readonly set: (x: number, y: number, z: number) => void;
    };
  };
};

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

export function shouldStartOfficeThreeAnimationLoop(
  motionMode: OfficeThreeMotionMode,
): boolean {
  return motionMode === "active";
}

export function OrchestratorOfficeThreeView({
  locale = "en",
  motionMode,
  onAngleDrag,
  rotation,
  scene,
  stage,
  teamId,
}: {
  readonly locale?: AppLocale;
  readonly motionMode: OfficeThreeMotionMode;
  readonly onAngleDrag: (deltaX: number, deltaY: number) => void;
  readonly rotation: OfficeRotation;
  readonly scene: OfficeCanvasScene;
  readonly stage: string;
  readonly teamId?: TeamId;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lifecycleRef = useRef<OfficeThreeViewLifecycle | null>(null);
  const [renderCount, setRenderCount] = useState(0);
  const [rendererMode, setRendererMode] = useState<"canvas" | "three">("three");
  const contract = useMemo(
    () => createOfficeThreeSceneCatalog({ locale, motionMode, stage, teamId }),
    [locale, motionMode, stage, teamId],
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
  const modelSource = "kenney-furniture-kit-real-assets";

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
      onFrameDiagnostics: (diagnostics) =>
        writeOfficeThreeCanvasDiagnostics(canvas, diagnostics),
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
    if (shouldStartOfficeThreeAnimationLoop(contract.scene.motion.mode)) {
      lifecycle.start();
    }

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
    <OrchestratorOfficeThreeCanvasSurface
      camera={camera}
      canvasRef={canvasRef}
      meshCount={meshCount}
      modelSource={modelSource}
      motionMode={contract.scene.motion.mode}
      onAngleDrag={onAngleDrag}
      pitch={pitch}
      renderCount={renderCount.toString()}
      rotation={rotation}
      yaw={yaw}
    />
  );
}
