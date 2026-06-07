import { PixelPerson } from "./orchestrator-office-agent";
import {
  OFFICE_COMMAND_TABLE_FRONT,
  OFFICE_COMMAND_TABLE_TOP,
  OFFICE_FLOOR_TILES,
  OFFICE_ROOM_SHELL,
  OFFICE_STATIC_POLYGONS,
  isoPoint,
  type AgentSlot,
  type OfficeAgent,
  type OfficeScenePolygon,
} from "./orchestrator-office-scene-data";

type Point = {
  readonly x: number;
  readonly y: number;
};

function footprint(
  tileX: number,
  tileY: number,
  width: number,
  depth: number,
  lift = 0,
) {
  return [
    isoPoint(tileX, tileY, lift),
    isoPoint(tileX + width, tileY, lift),
    isoPoint(tileX + width, tileY + depth, lift),
    isoPoint(tileX, tileY + depth, lift),
  ] as const;
}

function points(pointsToRender: readonly Point[]) {
  return pointsToRender.map((point) => `${point.x},${point.y}`).join(" ");
}

function line(pointsToRender: readonly Point[]) {
  const [start, ...rest] = pointsToRender;
  if (!start) {
    return "";
  }

  return `M ${start.x} ${start.y}${rest
    .map((point) => ` L ${point.x} ${point.y}`)
    .join("")}`;
}

function PolygonLayer({
  polygons,
}: {
  readonly polygons: readonly OfficeScenePolygon[];
}) {
  return polygons.map((polygon, index) => (
    <polygon
      className={polygon.className}
      data-testid={polygon.testId}
      key={`${polygon.className}-${index}`}
      points={points(polygon.points)}
    />
  ));
}

function DeskTop({ slot }: { readonly slot: AgentSlot }) {
  const top = footprint(
    slot.deskTile.x,
    slot.deskTile.y,
    slot.deskWidth,
    slot.deskDepth,
    52,
  );
  const monitor = footprint(
    slot.deskTile.x + 0.66,
    slot.deskTile.y + 0.12,
    0.34,
    0.18,
    86,
  );
  const keyboard = footprint(
    slot.deskTile.x + 0.56,
    slot.deskTile.y + 0.42,
    0.4,
    0.14,
    58,
  );
  const tray = footprint(
    slot.deskTile.x + 0.14,
    slot.deskTile.y + 0.34,
    0.34,
    0.18,
    56,
  );
  const glow = footprint(
    slot.deskTile.x + 0.69,
    slot.deskTile.y + 0.15,
    0.28,
    0.12,
    83,
  );
  const label = isoPoint(slot.deskTile.x + 0.58, slot.deskTile.y + 1.1);

  return (
    <g className="pixel-office__desk" data-testid="pixel-office-desk">
      <polygon className="pixel-office__desk-top" points={points(top)} />
      <polygon className="pixel-office__monitor" points={points(monitor)} />
      <polygon className="pixel-office__monitor-glow" points={points(glow)} />
      <polygon className="pixel-office__keyboard" points={points(keyboard)} />
      <polygon className="pixel-office__desk-tray" points={points(tray)} />
      <text
        className="pixel-office__station-label"
        textAnchor="middle"
        x={label.x}
        y={label.y}
      >
        {slot.station}
      </text>
    </g>
  );
}

function DeskFront({ slot }: { readonly slot: AgentSlot }) {
  const top = footprint(
    slot.deskTile.x,
    slot.deskTile.y,
    slot.deskWidth,
    slot.deskDepth,
    52,
  );
  const base = footprint(
    slot.deskTile.x,
    slot.deskTile.y,
    slot.deskWidth,
    slot.deskDepth,
  );

  return (
    <g>
      <polygon
        className="pixel-office__desk-front"
        points={points([top[3], top[2], base[2], base[3]])}
      />
      <polygon
        className="pixel-office__desk-side"
        points={points([top[1], top[2], base[2], base[1]])}
      />
      <polygon
        className="pixel-office__desk-trim"
        points={points([top[3], top[2], base[2], base[3]])}
      />
    </g>
  );
}

function Fixtures() {
  return (
    <>
      <g
        className="pixel-office__whiteboard"
        data-testid="pixel-office-whiteboard"
      >
        <polygon points="300,148 446,132 446,214 300,230" />
        <path d="M320 166 412 156M322 188 424 176M320 210 390 200" />
      </g>
      <g className="pixel-office__plant">
        <polygon
          className="pixel-office__planter"
          points="888,202 920,190 946,202 916,216"
        />
        <path
          className="pixel-office__plant-leaf"
          d="M916 194 C900 154 936 148 924 194"
        />
        <path
          className="pixel-office__plant-leaf"
          d="M922 196 C942 154 960 164 930 202"
        />
      </g>
    </>
  );
}

export function OrchestratorOfficeMap({
  agents,
  deskSlots,
}: {
  readonly agents: readonly OfficeAgent[];
  readonly deskSlots: readonly AgentSlot[];
}) {
  const desks = [...deskSlots].sort(
    (left, right) =>
      left.agentTile.x +
      left.agentTile.y -
      (right.agentTile.x + right.agentTile.y),
  );
  const officeAgents = [...agents].sort((left, right) => left.y - right.y);

  return (
    <svg
      aria-hidden="true"
      className="pixel-office__map"
      data-testid="pixel-agent-office"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="geometricPrecision"
      viewBox="0 0 1200 760"
    >
      <g
        className="pixel-office__room-shell"
        data-testid="pixel-office-room-shell"
      >
        <PolygonLayer polygons={OFFICE_ROOM_SHELL} />
        <PolygonLayer polygons={OFFICE_FLOOR_TILES} />
      </g>
      <PolygonLayer polygons={OFFICE_STATIC_POLYGONS} />
      <Fixtures />
      {desks.map((slot) => (
        <DeskTop key={`${slot.slotClass}-top`} slot={slot} />
      ))}
      <g
        className="pixel-office__command-table"
        data-testid="pixel-office-command-table"
      >
        <PolygonLayer polygons={OFFICE_COMMAND_TABLE_TOP} />
      </g>
      {desks.map((slot) => (
        <path
          className={`pixel-agent-motion-path ${slot.pathClass}`}
          d={line(slot.pathTiles.map((point) => isoPoint(point.x, point.y, 4)))}
          data-testid="pixel-agent-motion-path"
          key={`${slot.slotClass}-motion-path`}
        />
      ))}
      {officeAgents.map((agent) => (
        <PixelPerson agent={agent} key={agent.id} />
      ))}
      {desks.map((slot) => (
        <DeskFront key={`${slot.slotClass}-front`} slot={slot} />
      ))}
      <PolygonLayer polygons={OFFICE_COMMAND_TABLE_FRONT} />
    </svg>
  );
}
