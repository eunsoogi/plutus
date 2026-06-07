import type { OfficeCanvasPoint } from "./orchestrator-office-canvas-types";

export function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function pathPoints(
  context: CanvasRenderingContext2D,
  points: readonly OfficeCanvasPoint[],
): void {
  const [start, ...rest] = points;
  if (!start) return;

  context.beginPath();
  context.moveTo(start.x, start.y);
  for (const point of rest) {
    context.lineTo(point.x, point.y);
  }
}

export function withAlpha(
  context: CanvasRenderingContext2D,
  alpha: number | undefined,
  draw: () => void,
): void {
  if (alpha === undefined) {
    draw();
    return;
  }

  context.save();
  context.globalAlpha = alpha;
  draw();
  context.restore();
}
