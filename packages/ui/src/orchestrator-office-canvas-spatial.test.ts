import { describe, expect, it } from "vitest";
import { officeCuboids } from "./orchestrator-office-canvas-furnishings";
import { officeFurnitureRects } from "./orchestrator-office-canvas-furniture";
import {
  officeDepth,
  officeFootprint,
  projectOfficePoint,
} from "./orchestrator-office-canvas-geometry";
import { officeCopy } from "./orchestrator-office-copy";
import type {
  OfficeCanvasPoint,
  OfficeProjection,
  OfficeRotation,
} from "./orchestrator-office-canvas-types";
import { slotFor } from "./orchestrator-office-scene-data";
import { orderedTeamIds, teamSpecialists } from "./orchestrator-office-teams";

type Bounds = {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
};

type SceneRect = {
  readonly depth: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

const commandTableRect = {
  depth: 1.24,
  width: 2.34,
  x: 4.08,
  y: 3.54,
} satisfies SceneRect;

const commandTableCenter = {
  x: commandTableRect.x + commandTableRect.width / 2,
  y: commandTableRect.y + commandTableRect.depth / 2,
} as const;

const officeRotations = [
  "south-east",
  "south-west",
  "north-west",
  "north-east",
] satisfies readonly OfficeRotation[];

function rectGap(left: SceneRect, right: SceneRect): number {
  const dx = Math.max(
    0,
    Math.max(left.x - (right.x + right.width), right.x - (left.x + left.width)),
  );
  const dy = Math.max(
    0,
    Math.max(left.y - (right.y + right.depth), right.y - (left.y + left.depth)),
  );

  return Math.hypot(dx, dy);
}

function pointGap(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function boundsFor(points: readonly OfficeCanvasPoint[]): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    bottom: Math.max(...ys),
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
  };
}

function boundsGap(left: Bounds, right: Bounds): number {
  const dx = Math.max(0, Math.max(left.left - right.right, right.left - left.right));
  const dy = Math.max(0, Math.max(left.top - right.bottom, right.top - left.bottom));

  return Math.hypot(dx, dy);
}

function expectDepthOrderMatchesProjectedScreenY(
  projection: OfficeProjection,
  points: readonly OfficeCanvasPoint[],
): void {
  const sortedByDepth = [...points]
    .sort((left, right) => officeDepth(left, projection) - officeDepth(right, projection))
    .map((point) => `${point.x}:${point.y}`);
  const sortedByScreenY = [...points]
    .sort(
      (left, right) =>
        projectOfficePoint(left, projection).y -
        projectOfficePoint(right, projection).y,
    )
    .map((point) => `${point.x}:${point.y}`);

  expect(sortedByDepth).toEqual(sortedByScreenY);
}

describe("orchestrator office spatial layout", () => {
  it.each([
    {
      points: [
        { x: 0, y: 1 },
        { x: 2, y: 0 },
        { x: 4, y: 3 },
      ],
      projection: "south-east",
    },
    {
      points: [
        { x: 0, y: 2 },
        { x: 1, y: 0 },
        { x: 4, y: 4 },
      ],
      projection: 45,
    },
  ] satisfies readonly {
    readonly points: readonly OfficeCanvasPoint[];
    readonly projection: OfficeProjection;
  }[])(
    "keeps draw depth aligned with projected screen Y for %j",
    ({ points, projection }) => {
      expectDepthOrderMatchesProjectedScreenY(projection, points);
    },
  );

  it("changes projection vertical scale with clamped pitch", () => {
    const anchor = { x: 8, y: 6 } satisfies OfficeCanvasPoint;
    const defaultPitchPoint = projectOfficePoint(anchor, {
      pitch: 42,
      yaw: 0,
    });
    const lowPitchPoint = projectOfficePoint(anchor, { pitch: 28, yaw: 0 });
    const highPitchPoint = projectOfficePoint(anchor, { pitch: 58, yaw: 0 });
    const clampedHighPitchPoint = projectOfficePoint(anchor, {
      pitch: 999,
      yaw: 0,
    });

    expect(highPitchPoint.y).toBeGreaterThan(defaultPitchPoint.y + 20);
    expect(defaultPitchPoint.y).toBeGreaterThan(lowPitchPoint.y + 20);
    expect(clampedHighPitchPoint).toEqual(highPitchPoint);
  });

  it.each(orderedTeamIds)(
    "keeps %s desks and specialists outside the command table circulation zone",
    (teamId) => {
      const slots = teamSpecialists[teamId].map((_, index) =>
        slotFor(index, officeCopy.en.station),
      );
      const minDeskGap = Math.min(
        ...slots.map((slot) =>
          rectGap(commandTableRect, {
            depth: slot.deskDepth,
            width: slot.deskWidth,
            x: slot.deskTile.x,
            y: slot.deskTile.y,
          }),
        ),
      );
      const minAgentGap = Math.min(
        ...slots.map((slot) => pointGap(slot.agentTile, commandTableCenter)),
      );

      expect(minDeskGap).toBeGreaterThanOrEqual(1);
      expect(minAgentGap).toBeGreaterThanOrEqual(2.3);
    },
  );

  it.each(officeRotations)(
    "keeps projected desk depth clear around the command table in %s rotation",
    (rotation) => {
      const commandBounds = boundsFor(
        officeFootprint(
          commandTableRect.x,
          commandTableRect.y,
          commandTableRect.width,
          commandTableRect.depth,
          rotation,
          52,
        ),
      );
      const projectedDeskGaps = orderedTeamIds.flatMap((teamId) =>
        teamSpecialists[teamId].map((_, index) => {
          const slot = slotFor(index, officeCopy.en.station);

          return boundsGap(
            commandBounds,
            boundsFor(
              officeFootprint(
                slot.deskTile.x,
                slot.deskTile.y,
                slot.deskWidth,
                slot.deskDepth,
                rotation,
                48,
              ),
            ),
          );
        }),
      );

      expect(Math.min(...projectedDeskGaps)).toBeGreaterThanOrEqual(24);
    },
  );

  it("keeps surrounding furniture and cuboids outside the command table circulation zone", () => {
    const minFurnitureGap = Math.min(
      ...officeFurnitureRects.map((furniture) =>
        rectGap(commandTableRect, furniture),
      ),
    );
    const minCuboidGap = Math.min(
      ...officeCuboids.map((cuboid) => rectGap(commandTableRect, cuboid)),
    );

    expect(minFurnitureGap).toBeGreaterThanOrEqual(1.2);
    expect(minCuboidGap).toBeGreaterThanOrEqual(1.4);
  });
});
