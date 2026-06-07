import { roundedRect } from "./orchestrator-office-canvas-render-primitives";
import { officeRenderTransform } from "./orchestrator-office-canvas-render-frame";
import type {
  OfficeCanvasNameplateCommand,
  OfficeCanvasViewport,
} from "./orchestrator-office-canvas-types";

type OfficeNameplateMode = "compact" | "full";

export type OfficeNameplateFrame = {
  readonly height: number;
  readonly mode: OfficeNameplateMode;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

const MOBILE_LABEL_BREAKPOINT = 520;
const MOBILE_COMPACT_NAMEPLATE_SIZE = {
  height: 36,
  width: 58,
} as const;

export function officeNameplateFrame(
  command: OfficeCanvasNameplateCommand,
  viewport: OfficeCanvasViewport,
): OfficeNameplateFrame {
  if (viewport.width <= MOBILE_LABEL_BREAKPOINT) {
    const { scale } = officeRenderTransform(viewport);
    const width = MOBILE_COMPACT_NAMEPLATE_SIZE.width / scale;
    const height = MOBILE_COMPACT_NAMEPLATE_SIZE.height / scale;
    return {
      height,
      mode: "compact",
      width,
      x: command.at.x - width / 2,
      y: command.at.y - height,
    };
  }

  const width = command.label.length > 18 ? 246 : 198;
  const height = 68;
  return {
    height,
    mode: "full",
    width,
    x: command.at.x - width / 2,
    y: command.at.y - height,
  };
}

function renderCompactNameplate(
  context: CanvasRenderingContext2D,
  command: OfficeCanvasNameplateCommand,
  frame: OfficeNameplateFrame,
): void {
  const metricScale = frame.width / MOBILE_COMPACT_NAMEPLATE_SIZE.width;

  roundedRect(
    context,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    4 * metricScale,
  );
  context.fillStyle = "rgb(13 17 22 / 0.9)";
  context.fill();
  context.strokeStyle = command.accent;
  context.lineWidth = 1.5 * metricScale;
  context.stroke();

  context.fillStyle = command.accent;
  context.beginPath();
  context.arc(
    frame.x + 12 * metricScale,
    frame.y + frame.height / 2,
    4.5 * metricScale,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = "#f8fafc";
  context.font = `900 ${18 * metricScale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    command.shortLabel,
    frame.x + frame.width / 2 + 5 * metricScale,
    frame.y + frame.height / 2 + 0.5 * metricScale,
    frame.width - 22 * metricScale,
  );
}

function renderFullNameplate(
  context: CanvasRenderingContext2D,
  command: OfficeCanvasNameplateCommand,
  frame: OfficeNameplateFrame,
): void {
  roundedRect(context, frame.x, frame.y, frame.width, frame.height, 4);
  context.fillStyle = "rgb(13 17 22 / 0.92)";
  context.fill();
  context.strokeStyle = "rgb(159 210 234 / 0.32)";
  context.lineWidth = 1;
  context.stroke();

  context.fillStyle = command.accent;
  context.beginPath();
  context.arc(frame.x + frame.width - 18, frame.y + 21, 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f8fafc";
  context.font = "800 22px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(command.label, frame.x + 14, frame.y + 30, frame.width - 44);
  context.fillStyle = "#a9bac9";
  context.font = "800 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(
    command.station,
    frame.x + 14,
    frame.y + 51,
    frame.width - 28,
  );
}

export function renderNameplate(
  context: CanvasRenderingContext2D,
  command: OfficeCanvasNameplateCommand,
  viewport: OfficeCanvasViewport,
): void {
  const frame = officeNameplateFrame(command, viewport);

  context.save();
  if (frame.mode === "compact") {
    renderCompactNameplate(context, command, frame);
  } else {
    renderFullNameplate(context, command, frame);
  }
  context.restore();
}
