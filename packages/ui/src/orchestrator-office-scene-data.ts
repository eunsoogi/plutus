import type { SpecialistId } from "./orchestrator-office-teams";

export type AgentSlot = {
  readonly station: string;
  readonly deskX: number;
  readonly deskY: number;
  readonly feetX: number;
  readonly feetY: number;
  readonly slotClass: string;
  readonly routeClass: string;
  readonly pathClass: string;
  readonly pathD: string;
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

const defaultSpecialistSlot = {
  deskX: 270,
  deskY: 276,
  feetX: 358,
  feetY: 338,
  pathClass: "pixel-agent-motion-path--0",
  pathD: "M352 330 C424 342 492 368 560 402",
  routeClass: "pixel-agent--route-0",
  slotClass: "pixel-agent--slot-0",
  station: "Market desk",
} satisfies AgentSlot;

const specialistSlots = [
  defaultSpecialistSlot,
  {
    deskX: 596,
    deskY: 220,
    feetX: 684,
    feetY: 286,
    pathClass: "pixel-agent-motion-path--1",
    pathD: "M680 278 C648 316 624 344 586 396",
    routeClass: "pixel-agent--route-1",
    slotClass: "pixel-agent--slot-1",
    station: "Strategy board",
  },
  {
    deskX: 758,
    deskY: 386,
    feetX: 846,
    feetY: 450,
    pathClass: "pixel-agent-motion-path--2",
    pathD: "M840 442 C780 430 706 420 618 416",
    routeClass: "pixel-agent--route-2",
    slotClass: "pixel-agent--slot-2",
    station: "Risk table",
  },
  {
    deskX: 418,
    deskY: 468,
    feetX: 506,
    feetY: 532,
    pathClass: "pixel-agent-motion-path--3",
    pathD: "M500 522 C528 490 552 458 584 418",
    routeClass: "pixel-agent--route-3",
    slotClass: "pixel-agent--slot-3",
    station: "Report bay",
  },
  {
    deskX: 210,
    deskY: 446,
    feetX: 298,
    feetY: 512,
    pathClass: "pixel-agent-motion-path--4",
    pathD: "M304 504 C384 492 470 462 576 420",
    routeClass: "pixel-agent--route-4",
    slotClass: "pixel-agent--slot-4",
    station: "Portfolio row",
  },
] satisfies readonly AgentSlot[];

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

export function slotFor(index: number): AgentSlot {
  return specialistSlots[index] ?? defaultSpecialistSlot;
}

export function specialistAgent(
  specialist: SpecialistId,
  index: number,
  label: string,
): OfficeAgent {
  const slot = slotFor(index);
  return {
    id: specialist,
    label,
    role: "Specialist",
    shortLabel: specialistShortLabels[specialist],
    station: slot.station,
    testId: `orchestrator-agent-${specialist}`,
    toneClass: specialistTones[specialist],
    x: slot.feetX,
    y: slot.feetY,
    slotClass: slot.slotClass,
    routeClass: slot.routeClass,
  };
}
