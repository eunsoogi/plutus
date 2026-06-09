import { describe, expect, it } from "vitest";
import { officeNameplateFrame } from "./orchestrator-office-canvas-nameplates";
import { officeRenderTransform } from "./orchestrator-office-canvas-render-frame";
import type { OfficeCanvasViewport } from "./orchestrator-office-canvas-types";
import {
  boundsFor,
  defaultOfficeSceneCommands,
  expectNoOverlappingFrames,
  expectRenderedFramesStayInsideViewportGutter,
  mobileNameplateCases,
  nameplateCommands,
  officeRotations,
  polygonPoints,
  renderedBounds,
} from "./orchestrator-office-canvas-renderer-test-helpers";
import { defaultTeam } from "./orchestrator-office-teams";

const mobileViewport = {
  height: 500,
  width: 390,
} satisfies OfficeCanvasViewport;

const desktopViewport = {
  height: 760,
  width: 1200,
} satisfies OfficeCanvasViewport;

const mobileCompactCssSize = { height: 36, width: 58 } as const;
const mobileViewportGutter = 8;
const desktopSceneGutter = 16;

describe("officeNameplateFrame", () => {
  it("keeps max-pitch office geometry inside the desktop render frame", () => {
    const renderedSceneBounds = renderedBounds(
      boundsFor(polygonPoints(defaultOfficeSceneCommands())),
      desktopViewport,
    );

    expect(renderedSceneBounds.left).toBeGreaterThanOrEqual(desktopSceneGutter);
    expect(renderedSceneBounds.right).toBeLessThanOrEqual(
      desktopViewport.width - desktopSceneGutter,
    );
    expect(renderedSceneBounds.top).toBeGreaterThanOrEqual(desktopSceneGutter);
    expect(renderedSceneBounds.bottom).toBeLessThanOrEqual(
      desktopViewport.height - desktopSceneGutter,
    );
  });

  it("keeps desktop render scale near normal size", () => {
    expect(officeRenderTransform(desktopViewport).scale).toBeGreaterThanOrEqual(
      0.95,
    );
  });

  it("keeps desktop canvas nameplates in full card mode", () => {
    const frames = nameplateCommands().map((command) =>
      officeNameplateFrame(command, desktopViewport),
    );

    expect(frames.every((frame) => frame.mode === "full")).toBe(true);
  });

  it.each(officeRotations)(
    "keeps default desktop canvas nameplates non-overlapping in %s rotation",
    (rotation) => {
      const frames = nameplateCommands(defaultTeam, rotation).map((command) =>
        officeNameplateFrame(command, desktopViewport),
      );

      expectNoOverlappingFrames(frames, expect);
    },
  );

  it.each(mobileNameplateCases)(
    "keeps mobile canvas nameplates compact and non-overlapping for $teamId in $rotation",
    ({ rotation, teamId }) => {
      const frames = nameplateCommands(teamId, rotation).map((command) =>
        officeNameplateFrame(command, mobileViewport),
      );

      expect(frames.every((frame) => frame.mode === "compact")).toBe(true);
      expectNoOverlappingFrames(frames, expect);
    },
  );

  it("keeps mobile compact nameplates readable after render scaling", () => {
    const { scale } = officeRenderTransform(mobileViewport);
    const frames = nameplateCommands().map((command) =>
      officeNameplateFrame(command, mobileViewport),
    );

    expect(frames.every((frame) => frame.mode === "compact")).toBe(true);
    for (const frame of frames) {
      expect(frame.width * scale).toBeCloseTo(mobileCompactCssSize.width, 1);
      expect(frame.height * scale).toBeCloseTo(mobileCompactCssSize.height, 1);
    }
    expectNoOverlappingFrames(frames, expect);
  });

  it.each(mobileNameplateCases)(
    "keeps rendered mobile compact nameplates inside the viewport gutter for $teamId in $rotation",
    ({ rotation, teamId }) => {
      const frames = nameplateCommands(teamId, rotation).map((command) =>
        officeNameplateFrame(command, mobileViewport),
      );

      expectRenderedFramesStayInsideViewportGutter(
        frames,
        mobileViewport,
        mobileViewportGutter,
        expect,
      );
    },
  );
});
