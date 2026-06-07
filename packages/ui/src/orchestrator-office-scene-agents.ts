import {
  officeCopy,
  type OfficeStationLabels,
} from "./orchestrator-office-copy";
import {
  specialistCallSign,
  type SpecialistId,
} from "./orchestrator-office-teams";

export type GridPoint = { readonly x: number; readonly y: number };

type OfficeStationId = keyof OfficeStationLabels;

export type AgentTone =
  | "amber"
  | "blue"
  | "cyan"
  | "green"
  | "lead"
  | "lilac"
  | "mint"
  | "rose"
  | "violet";

export type AgentSlot = {
  readonly station: string;
  readonly deskTile: GridPoint;
  readonly deskWidth: number;
  readonly deskDepth: number;
  readonly agentTile: GridPoint;
};

export type OfficeAgent = {
  readonly id: SpecialistId | "orchestrator";
  readonly label: string;
  readonly role: string;
  readonly shortLabel: string;
  readonly station: string;
  readonly tile: GridPoint;
  readonly tone: AgentTone;
  readonly testId: string;
  readonly isLead?: boolean;
};

type AgentSlotLayout = Omit<AgentSlot, "station"> & {
  readonly station: OfficeStationId;
};

const slot = (
  station: OfficeStationId,
  deskTile: GridPoint,
  agentTile: GridPoint,
): AgentSlotLayout => ({
  agentTile,
  deskDepth: 0.88,
  deskTile,
  deskWidth: 1.22,
  station,
});

const point = (x: number, y: number): GridPoint => ({ x, y });

const defaultStationLabels = officeCopy.en.station;

const defaultSpecialistSlot = slot(
  "market_desk",
  point(1.55, 1.8),
  point(2.75, 3.25),
);

const specialistSlots = [
  defaultSpecialistSlot,
  slot(
    "strategy_board",
    point(5.95, 1.35),
    point(7.05, 2.8),
  ),
  slot(
    "risk_table",
    point(7.05, 4.15),
    point(7.95, 5.45),
  ),
  slot(
    "report_bay",
    point(1.9, 4.75),
    point(4.25, 5.7),
  ),
  slot(
    "signal_booth",
    point(3.35, 0.9),
    point(4.4, 2.15),
  ),
] satisfies readonly AgentSlotLayout[];

const specialistTones = {
  crypto_analyst: "mint",
  equity_analyst: "green",
  llm_wiki_curator: "lilac",
  market_data_researcher: "cyan",
  portfolio_manager: "green",
  quant_strategy_researcher: "violet",
  report_writer: "blue",
  risk_manager: "amber",
  technical_analyst: "rose",
} satisfies Record<SpecialistId, AgentTone>;

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

  return {
    id: specialist,
    label,
    role: "Specialist",
    shortLabel: specialistCallSign(specialist),
    station: slot.station,
    testId: `orchestrator-agent-${specialist}`,
    tile: slot.agentTile,
    tone: specialistTones[specialist],
  };
}
