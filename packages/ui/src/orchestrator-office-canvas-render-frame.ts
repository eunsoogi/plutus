import type { OfficeCanvasViewport } from "./orchestrator-office-canvas-types";

type OfficeRenderFrame = {
  readonly centerX: number;
  readonly centerY: number;
  readonly height: number;
  readonly width: number;
};

type OfficeRenderTransform = {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
};

const DESKTOP_FRAME: OfficeRenderFrame = {
  centerX: 600,
  centerY: 404,
  height: 670,
  width: 1080,
};

const COMPACT_FRAME: OfficeRenderFrame = {
  centerX: 600,
  centerY: 412,
  height: 700,
  width: 940,
};

const MOBILE_FRAME: OfficeRenderFrame = {
  centerX: 600,
  centerY: 418,
  height: 720,
  width: 900,
};

function renderFrameFor(viewport: OfficeCanvasViewport): OfficeRenderFrame {
  if (viewport.width <= 520) return MOBILE_FRAME;
  if (viewport.width <= 760) return COMPACT_FRAME;
  return DESKTOP_FRAME;
}

export function officeRenderTransform(
  viewport: OfficeCanvasViewport,
): OfficeRenderTransform {
  const frame = renderFrameFor(viewport);
  const scale = Math.min(
    viewport.width / frame.width,
    viewport.height / frame.height,
  );

  return {
    offsetX: viewport.width / 2 - frame.centerX * scale,
    offsetY: viewport.height / 2 - frame.centerY * scale,
    scale,
  };
}
