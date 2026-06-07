import {
  officeCopy,
  type OfficeStationLabels,
} from "./orchestrator-office-copy";
import {
  isoPoint,
  point,
  type GridPoint,
} from "./orchestrator-office-scene-geometry";
import type { SpecialistId } from "./orchestrator-office-teams";

type OfficeStationId = keyof OfficeStationLabels;

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
