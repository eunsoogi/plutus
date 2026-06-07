import {
  officeCopy,
  type OfficeStationLabels,
} from "./orchestrator-office-copy";
import type { SpecialistId } from "./orchestrator-office-teams";

type GridPoint = { readonly x: number; readonly y: number };
type OfficeStationId = keyof OfficeStationLabels;

export type OfficeScenePolygon = {
  readonly className: string;
  readonly points: readonly GridPoint[];
  readonly testId?: string;
};

export const OFFICE_TILE_WIDTH = 92;
export const OFFICE_TILE_HEIGHT = 46;
export const OFFICE_ROOM_COLUMNS = 10;
export const OFFICE_ROOM_ROWS = 7;

const OFFICE_ORIGIN = { x: 576, y: 220 } as const;
const WALL_HEIGHT = 126;

export type AgentSlot = {
  readonly station: string;
  readonly deskTile: GridPoint;
  readonly deskWidth: number;
  readonly deskDepth: number;
  readonly agentTile: GridPoint;
  readonly agentOffsetX: number;
  readonly agentOffsetY: number;
  readonly slotClass: string;
  readonly routeClass: string;
  readonly pathClass: string;
  readonly pathTiles: readonly GridPoint[];
};

export type OfficeAgent = {
  readonly id: SpecialistId | "orchestrator";
  readonly label: string;
  readonly role: string;
  readonly shortLabel: string;
  readonly station: string;
  readonly toneClass: string;
  readonly testId: string;
  readonly x: number;
  readonly y: number;
  readonly slotClass: string;
  readonly routeClass: string;
  readonly isLead?: boolean;
};

export function isoPoint(gridX: number, gridY: number, lift = 0): GridPoint {
  return {
    x: OFFICE_ORIGIN.x + (gridX - gridY) * (OFFICE_TILE_WIDTH / 2),
    y: OFFICE_ORIGIN.y + (gridX + gridY) * (OFFICE_TILE_HEIGHT / 2) - lift,
  };
}

const point = (x: number, y: number): GridPoint => ({ x, y });

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

const polygon = (
  className: string,
  points: readonly GridPoint[],
  testId?: string,
): OfficeScenePolygon => ({ className, points, testId });

const room = footprint(0, 0, OFFICE_ROOM_COLUMNS, OFFICE_ROOM_ROWS);
const [roomNorthWest, roomNorthEast, roomSouthEast, roomSouthWest] = room;
const booth = footprint(8.1, 1.15, 1.1, 1.55);
const boothWall = footprint(8.95, 1.15, 0.25, 1.55, 86);
const commandTop = footprint(4.35, 3.85, 1.85, 1.05, 42);
const commandBase = footprint(4.35, 3.85, 1.85, 1.05);

export const OFFICE_ROOM_SHELL = [
  polygon("pixel-office__back-wall", [
    isoPoint(0, 0, WALL_HEIGHT),
    isoPoint(OFFICE_ROOM_COLUMNS, 0, WALL_HEIGHT),
    roomNorthEast,
    roomNorthWest,
  ]),
  polygon("pixel-office__right-wall", [
    isoPoint(OFFICE_ROOM_COLUMNS, 0, WALL_HEIGHT),
    isoPoint(OFFICE_ROOM_COLUMNS, OFFICE_ROOM_ROWS, WALL_HEIGHT),
    roomSouthEast,
    roomNorthEast,
  ]),
  polygon("pixel-office__left-wall", [
    isoPoint(0, 0, WALL_HEIGHT),
    isoPoint(0, OFFICE_ROOM_ROWS, 84),
    roomSouthWest,
    roomNorthWest,
  ]),
  polygon("pixel-office__floor-outline", room, "orchestrator-office-floor"),
  polygon("pixel-office__front-lip", [
    roomSouthWest,
    roomSouthEast,
    point(roomSouthEast.x, roomSouthEast.y + 26),
    point(roomSouthWest.x, roomSouthWest.y + 26),
  ]),
] satisfies readonly OfficeScenePolygon[];

export const OFFICE_FLOOR_TILES = Array.from(
  { length: OFFICE_ROOM_ROWS },
  (_, row) =>
    Array.from({ length: OFFICE_ROOM_COLUMNS }, (_, column) =>
      polygon(
        (column + row) % 2 === 0
          ? "pixel-office__tile pixel-office__tile--light"
          : "pixel-office__tile pixel-office__tile--warm",
        footprint(column, row, 1, 1),
      ),
    ),
).flat();

export const OFFICE_STATIC_POLYGONS = [
  ...[
    [
      [408, 134],
      [532, 120],
      [532, 194],
      [408, 208],
    ],
    [
      [562, 118],
      [688, 104],
      [688, 178],
      [562, 192],
    ],
    [
      [714, 102],
      [846, 88],
      [846, 162],
      [714, 176],
    ],
  ].map((windowPoints) =>
    polygon(
      "pixel-office__window-frame",
      windowPoints.map(([x, y]) => point(x, y)),
    ),
  ),
  polygon(
    "pixel-office__side-room-floor",
    footprint(0.55, 5.05, 1.45, 1.05),
    "pixel-office-side-room",
  ),
  polygon("pixel-office__equipment", footprint(0.82, 5.22, 0.74, 0.22, 56)),
  polygon("pixel-office__side-room-floor", booth, "pixel-office-side-room"),
  polygon("pixel-office__glass-pod-wall", [
    boothWall[0],
    boothWall[1],
    booth[1],
    booth[0],
  ]),
  polygon("pixel-office__glass-pod-wall", [
    boothWall[1],
    boothWall[2],
    booth[2],
    booth[1],
  ]),
  polygon(
    "pixel-office__zone-rug pixel-office__zone-rug--mint",
    footprint(1.2, 1.35, 2.9, 2.35),
  ),
  polygon(
    "pixel-office__zone-rug pixel-office__zone-rug--amber",
    footprint(5.45, 0.9, 2.55, 2.35),
  ),
  polygon(
    "pixel-office__zone-rug pixel-office__zone-rug--blue",
    footprint(6.6, 3.85, 2.6, 2.35),
  ),
  polygon(
    "pixel-office__zone-rug pixel-office__zone-rug--rose",
    footprint(1.55, 4.35, 2.45, 2.1),
  ),
  polygon("pixel-office__command-rug", footprint(3.8, 3.5, 3, 2.25)),
  polygon("pixel-office__aisle-rug", footprint(4.55, 1.35, 1.2, 5.2)),
] satisfies readonly OfficeScenePolygon[];

export const OFFICE_COMMAND_TABLE_TOP = [
  polygon("pixel-office__command-top", commandTop),
  polygon("pixel-office__command-screen", footprint(5.05, 3.98, 0.44, 0.2, 74)),
  polygon(
    "pixel-office__command-screen",
    footprint(5.45, 4.18, 0.36, 0.16, 70),
  ),
] satisfies readonly OfficeScenePolygon[];

export const OFFICE_COMMAND_TABLE_FRONT = [
  polygon("pixel-office__command-front", [
    commandTop[3],
    commandTop[2],
    commandBase[2],
    commandBase[3],
  ]),
  polygon("pixel-office__command-side", [
    commandTop[1],
    commandTop[2],
    commandBase[2],
    commandBase[1],
  ]),
  polygon("pixel-office__chair", footprint(4.1, 4.45, 0.36, 0.3, 12)),
  polygon("pixel-office__chair", footprint(6.15, 4.18, 0.36, 0.3, 12)),
] satisfies readonly OfficeScenePolygon[];

type AgentSlotLayout = Omit<AgentSlot, "station"> & {
  readonly station: OfficeStationId;
};

const slot = (
  station: OfficeStationId,
  deskTile: GridPoint,
  agentTile: GridPoint,
  index: number,
  pathTiles: readonly GridPoint[],
  agentOffsetY = 0,
): AgentSlotLayout => ({
  agentOffsetX: 0,
  agentOffsetY,
  agentTile,
  deskDepth: 0.88,
  deskTile,
  deskWidth: 1.22,
  pathClass: `pixel-agent-motion-path--${index}`,
  pathTiles,
  routeClass: `pixel-agent--route-${index}`,
  slotClass: `pixel-agent--slot-${index}`,
  station,
});

const defaultStationLabels = officeCopy.en.station;

const defaultSpecialistSlot = slot(
  "market_desk",
  point(1.55, 1.8),
  point(2.75, 3.25),
  0,
  [point(4.9, 5.15), point(4.25, 4.4), point(3.55, 3.65)],
);

const specialistSlots = [
  defaultSpecialistSlot,
  slot(
    "strategy_board",
    point(5.95, 1.35),
    point(7.05, 2.8),
    1,
    [point(5.2, 5.05), point(5.85, 4.1), point(6.45, 3.1)],
    2,
  ),
  slot(
    "risk_table",
    point(7.05, 4.15),
    point(7.95, 5.45),
    2,
    [point(5.55, 5.25), point(6.45, 5.35), point(7.3, 5.45)],
    4,
  ),
  slot(
    "report_bay",
    point(1.9, 4.75),
    point(4.25, 5.7),
    3,
    [point(4.9, 5.35), point(4.45, 5.65), point(3.95, 5.95)],
    2,
  ),
  slot(
    "signal_booth",
    point(3.35, 0.9),
    point(4.4, 2.15),
    4,
    [point(5.1, 4.9), point(5, 3.95), point(4.85, 3.05)],
    2,
  ),
] satisfies readonly AgentSlotLayout[];

const specialistShortLabels = {
  crypto_analyst: "CA",
  equity_analyst: "EQ",
  llm_wiki_curator: "WK",
  market_data_researcher: "MD",
  portfolio_manager: "PM",
  quant_strategy_researcher: "QS",
  report_writer: "RW",
  risk_manager: "RM",
  technical_analyst: "TA",
} satisfies Record<SpecialistId, string>;

const specialistTones = {
  crypto_analyst: "pixel-agent--mint",
  equity_analyst: "pixel-agent--green",
  llm_wiki_curator: "pixel-agent--lilac",
  market_data_researcher: "pixel-agent--cyan",
  portfolio_manager: "pixel-agent--green",
  quant_strategy_researcher: "pixel-agent--violet",
  report_writer: "pixel-agent--blue",
  risk_manager: "pixel-agent--amber",
  technical_analyst: "pixel-agent--rose",
} satisfies Record<SpecialistId, string>;

function localizedSlot(
  slotLayout: AgentSlotLayout,
  stationLabels: OfficeStationLabels,
): AgentSlot {
  return {
    ...slotLayout,
    station: stationLabels[slotLayout.station],
  };
}

export function slotFor(
  index: number,
  stationLabels: OfficeStationLabels = defaultStationLabels,
): AgentSlot {
  return localizedSlot(
    specialistSlots[index] ?? defaultSpecialistSlot,
    stationLabels,
  );
}

export function specialistAgent(
  specialist: SpecialistId,
  index: number,
  label: string,
  stationLabels: OfficeStationLabels = defaultStationLabels,
): OfficeAgent {
  const slot = slotFor(index, stationLabels);
  const feet = isoPoint(slot.agentTile.x, slot.agentTile.y);

  return {
    id: specialist,
    label,
    role: "Specialist",
    shortLabel: specialistShortLabels[specialist],
    station: slot.station,
    testId: `orchestrator-agent-${specialist}`,
    toneClass: specialistTones[specialist],
    x: feet.x + slot.agentOffsetX,
    y: feet.y + slot.agentOffsetY,
    slotClass: slot.slotClass,
    routeClass: slot.routeClass,
  };
}
