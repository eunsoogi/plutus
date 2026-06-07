import { officeRenderTransform } from "./orchestrator-office-canvas-render-frame";
import {
  pathPoints,
  roundedRect,
  withAlpha,
} from "./orchestrator-office-canvas-render-primitives";
import { renderNameplate } from "./orchestrator-office-canvas-nameplates";
import type {
  OfficeCanvasAgentCommand,
  OfficeCanvasPolygonCommand,
  OfficeCanvasRectCommand,
  OfficeCanvasViewport,
  OfficeDrawCommand,
} from "./orchestrator-office-canvas-types";

function assertNever(value: never): never {
  throw new Error(`Unhandled canvas command: ${value}`);
}

function renderPolygon(
  context: CanvasRenderingContext2D,
  command: OfficeCanvasPolygonCommand,
): void {
  withAlpha(context, command.alpha, () => {
    pathPoints(context, command.points);
    context.closePath();
    context.fillStyle = command.fill;
    context.fill();
    if (command.stroke) {
      context.lineWidth = command.lineWidth ?? 1;
      context.strokeStyle = command.stroke;
      context.stroke();
    }
  });
}

function renderRect(
  context: CanvasRenderingContext2D,
  command: OfficeCanvasRectCommand,
): void {
  withAlpha(context, command.alpha, () => {
    roundedRect(
      context,
      command.x,
      command.y,
      command.width,
      command.height,
      command.radius ?? 0,
    );
    context.fillStyle = command.fill;
    context.fill();
    if (command.stroke) {
      context.lineWidth = command.lineWidth ?? 1;
      context.strokeStyle = command.stroke;
      context.stroke();
    }
  });
}

function renderAgent(
  context: CanvasRenderingContext2D,
  command: OfficeCanvasAgentCommand,
): void {
  const scale = command.isLead ? 1.22 : 1.08;
  const width = 28 * scale;
  const height = 54 * scale;
  const headRadius = 15 * scale;
  const x = command.at.x;
  const y = command.at.y;

  context.save();
  context.translate(x, y);
  context.fillStyle = "rgb(22 26 31 / 0.22)";
  context.beginPath();
  context.ellipse(0, 6, 24 * scale, 10 * scale, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#425568";
  roundedRect(context, -width / 2, -height + 14, width, height, 5);
  context.fill();
  context.fillStyle = command.fill;
  roundedRect(context, -width / 2, -height + 10, width, 30 * scale, 5);
  context.fill();

  context.fillStyle = "#efc7a0";
  context.beginPath();
  context.arc(0, -height - headRadius + 16, headRadius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#4b392c";
  roundedRect(
    context,
    -headRadius,
    -height - headRadius + 5,
    headRadius * 2,
    10,
    4,
  );
  context.fill();

  context.fillStyle = "#132334";
  context.font = `800 ${command.isLead ? 18 : 16}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(command.shortLabel, 0, -height + 27);
  context.restore();
}

function renderCommand(
  context: CanvasRenderingContext2D,
  command: OfficeDrawCommand,
  viewport: OfficeCanvasViewport,
): void {
  switch (command.kind) {
    case "agent":
      renderAgent(context, command);
      return;
    case "nameplate":
      renderNameplate(context, command, viewport);
      return;
    case "polygon":
      renderPolygon(context, command);
      return;
    case "rect":
      renderRect(context, command);
      return;
    default:
      assertNever(command);
  }
}

export function renderOfficeCanvas(
  context: CanvasRenderingContext2D,
  commands: readonly OfficeDrawCommand[],
  viewport: OfficeCanvasViewport,
): void {
  context.clearRect(0, 0, viewport.width, viewport.height);
  const { offsetX, offsetY, scale } = officeRenderTransform(viewport);

  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);
  for (const command of commands) {
    renderCommand(context, command, viewport);
  }
  context.restore();
}
