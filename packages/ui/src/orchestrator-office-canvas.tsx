import { useEffect, useMemo, useRef } from "react";
import { buildOfficeDrawCommands } from "./orchestrator-office-canvas-layout";
import { renderOfficeCanvas } from "./orchestrator-office-canvas-renderer";
import type { OfficeCanvasScene } from "./orchestrator-office-canvas-types";

export function OrchestratorOfficeCanvas({
  scene,
}: {
  readonly scene: OfficeCanvasScene;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const commands = useMemo(() => buildOfficeDrawCommands(scene), [scene]);

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

  return (
    <canvas
      aria-hidden="true"
      className="orchestrator-office__canvas"
      data-office-rotation={scene.rotation}
      data-testid="orchestrator-office-canvas"
      ref={canvasRef}
    />
  );
}
