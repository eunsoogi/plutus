import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { officeCopy } from "./orchestrator-office-copy";
import { officeMotionModeForRunStatus } from "./orchestrator-office-motion";
import {
  OrchestratorOffice,
  sceneStageLabel,
  type OrchestratorOfficeRun,
} from "./orchestrator-office";
import { I18nProvider } from "./i18n";
import {
  nextOfficeRotation,
  officeRotationLabel,
  projectOfficePoint,
} from "./orchestrator-office-canvas-geometry";
import { buildOfficeDrawCommands } from "./orchestrator-office-canvas-layout";
import { OrchestratorOfficeScene } from "./orchestrator-office-scene";
import { slotFor } from "./orchestrator-office-scene-data";
import { officeTeamLabel, teamSpecialists } from "./orchestrator-office-teams";

describe("ui office rendering", () => {
  it("assigns each selected specialist a unique office slot", () => {
    for (const specialists of Object.values(teamSpecialists)) {
      const slotKeys = specialists.map(
        (_, index) =>
          `${slotFor(index).deskTile.x}:${slotFor(index).deskTile.y}`,
      );
      expect(new Set(slotKeys).size).toBe(slotKeys.length);
    }
  });

  it("keeps Korean office stage labels localized without raw run statuses", () => {
    expect(sceneStageLabel("계획", "queued")).toBe("계획");
    expect(sceneStageLabel("계획", "ready")).toBe("계획");
    expect(sceneStageLabel("완료", "completed")).toBe("완료");
  });

  it("derives office motion from raw run status instead of localized stage text", () => {
    expect(officeMotionModeForRunStatus("executing")).toBe("active");
    expect(officeMotionModeForRunStatus("running")).toBe("active");
    expect(officeMotionModeForRunStatus("active")).toBe("active");
    expect(officeMotionModeForRunStatus("queued")).toBe("idle");
    expect(officeMotionModeForRunStatus("ready")).toBe("idle");
    expect(officeMotionModeForRunStatus("planning")).toBe("active");
    expect(officeMotionModeForRunStatus("completed")).toBe("idle");
  });

  it("localizes office station labels in Korean scenes", () => {
    const koreanOffice = officeCopy.ko;
    const markup = renderToStaticMarkup(
      createElement(OrchestratorOfficeScene, {
        angle: 0,
        canvasChromeLabels: koreanOffice.canvasChrome,
        motionMode: "idle",
        onAngleDrag: () => {},
        orchestratorLabel: koreanOffice.orchestrator,
        rotation: "south-east",
        specialistLabels: koreanOffice.specialist,
        specialists: teamSpecialists.portfolio_review_committee,
        stage: koreanOffice.stage.planning,
        stationLabels: koreanOffice.station,
        teamLabel: "포트폴리오 리뷰 위원회",
      }),
    );

    expect(markup).toContain("시장 데스크");
    expect(markup).toContain("전략 보드");
    expect(markup).toContain("리스크 테이블");
    expect(markup).toContain("지휘 테이블");
    expect(markup).not.toContain("Market desk");
    expect(markup).not.toContain("Strategy board");
    expect(markup).not.toContain("Risk table");
    expect(markup).not.toContain("Command table");
  });

  it("keeps the canvas office richly staged with furniture and nameplate layers", () => {
    const englishOffice = officeCopy.en;
    const specialists = teamSpecialists.quant_strategy_desk;
    const agents = specialists.map((specialist, index) => ({
      id: specialist,
      isLead: false,
      label: englishOffice.specialist[specialist],
      role: englishOffice.station.market_desk,
      shortLabel: "A",
      station: slotFor(index, englishOffice.station).station,
      testId: specialist,
      tile: slotFor(index, englishOffice.station).agentTile,
      tone: "cyan" as const,
    }));
    const commands = buildOfficeDrawCommands({
      agents,
      deskSlots: specialists.map((_, index) =>
        slotFor(index, englishOffice.station),
      ),
      rotation: "south-east",
    });

    expect(commands.length).toBeGreaterThanOrEqual(170);
    expect(
      commands.filter((command) => command.kind === "polygon").length,
    ).toBeGreaterThanOrEqual(140);
    expect(
      commands.filter((command) => command.kind === "nameplate").length,
    ).toBe(specialists.length);
  });

  it("renders Korean office rotation controls without mutating the selected run team", () => {
    const run = {
      category: "risk_warning",
      finalCard: { selectedTeam: "quant_strategy_desk" },
      id: "run-real",
      selectedTeam: "crypto_research_desk",
      status: "completed",
      title: "BTC and NVDA risk review",
    } satisfies OrchestratorOfficeRun;

    vi.stubGlobal("window", {
      localStorage: { getItem: () => null },
      location: { href: "https://plutus.local/?locale=ko" },
    });
    vi.stubGlobal("navigator", { languages: ["ko-KR"] });
    const markup = renderToStaticMarkup(
      createElement(I18nProvider, {
        children: createElement(OrchestratorOffice, { run }),
      }),
    );
    vi.unstubAllGlobals();

    expect(markup).toContain(">왼쪽</button>");
    expect(markup).toContain(">남동쪽</strong>");
    expect(markup).toContain(">오른쪽</button>");
    expect(markup).toContain("크립토 리서치 데스크");
    expect(markup).not.toMatch(
      /South East|>Left<\/button>|>Right<\/button>|Quant Strategy Desk<\/strong>/,
    );
  });

  it("localizes the visible Korean office canvas chrome", () => {
    const run = {
      category: "portfolio_review",
      finalCard: { selectedTeam: "portfolio_review_committee" },
      id: "run-korean-chrome",
      selectedTeam: "portfolio_review_committee",
      status: "completed",
      title: "Portfolio review",
    } satisfies OrchestratorOfficeRun;

    vi.stubGlobal("window", {
      localStorage: { getItem: () => null },
      location: { href: "https://plutus.local/?locale=ko" },
    });
    vi.stubGlobal("navigator", { languages: ["ko-KR"] });
    const markup = renderToStaticMarkup(
      createElement(I18nProvider, {
        children: createElement(OrchestratorOffice, { run }),
      }),
    );
    vi.unstubAllGlobals();

    expect(markup).toContain("에이전트 5명");
    expect(markup).toContain("HQ 연결됨");
    expect(markup).toContain("캔버스");
    expect(markup).toContain("본부 열기");
    expect(markup).toContain("시장");
    expect(markup).toContain("분석");
    expect(markup).toContain("PLUTUS 이벤트 콘솔");
    expect(markup).toContain("실거래 없음");
    expect(markup).not.toMatch(
      />\d+ agents<|HQ connected|>Canvas<|>Open HQ<|>Market<|>Analytics<|PLUTUS EVENT CONSOLE|No live trading/,
    );
  });

  it("displays an unknown selected office team with the default roster fallback", () => {
    const run = {
      category: "portfolio_review",
      finalCard: {
        selectedTeam: "quant_strategy_desk",
      },
      id: "run-legacy-team",
      selectedTeam: "legacy_alpha_desk",
      status: "completed",
      title: "Legacy team run",
    } satisfies OrchestratorOfficeRun;

    const markup = renderToStaticMarkup(
      createElement(OrchestratorOffice, { run }),
    );

    expect(markup).toContain("legacy_alpha_desk</strong>");
    expect(markup).toContain('value="legacy_alpha_desk"');
    expect(markup).toContain("Portfolio Manager");
    expect(markup).not.toContain("Quant Strategy Researcher");
  });

  it("keeps the office guard stable when an empty run is followed by a populated run", () => {
    const emptyRun = {
      category: "",
      id: "",
      status: "ready",
      title: "Pending run",
    } satisfies OrchestratorOfficeRun;
    const populatedRun = {
      category: "risk_warning",
      finalCard: {
        riskChecklist: [{ check: "Concentration", status: "warning" }],
        selectedTeam: "portfolio_review_committee",
        supportingEvidence: [{ label: "Real portfolio" }],
      },
      id: "run-real",
      status: "completed",
      title: "BTC and NVDA risk review",
    } satisfies OrchestratorOfficeRun;

    const emptyMarkup = renderToStaticMarkup(
      createElement(OrchestratorOffice, { run: emptyRun }),
    );
    const populatedMarkup = renderToStaticMarkup(
      createElement(OrchestratorOffice, { run: populatedRun }),
    );

    expect(emptyMarkup).toBe("");
    expect(populatedMarkup).toContain(
      'data-testid="orchestrator-office-team-name"',
    );
    expect(populatedMarkup).toContain("Portfolio Review Committee");
  });

  it("cycles office rotations through four discrete orientations", () => {
    expect(nextOfficeRotation("south-east", "right")).toBe("south-west");
    expect(nextOfficeRotation("south-west", "right")).toBe("north-west");
    expect(nextOfficeRotation("north-west", "right")).toBe("north-east");
    expect(nextOfficeRotation("north-east", "right")).toBe("south-east");
    expect(nextOfficeRotation("south-east", "left")).toBe("north-east");
    expect(officeRotationLabel("north-west")).toBe("North West");
  });

  it("projects the same office point to different canvas positions after rotation", () => {
    const point = { x: 2, y: 5 };
    const southEastPoint = projectOfficePoint(point, "south-east");
    const northWestPoint = projectOfficePoint(point, "north-west");
    const northEastPoint = projectOfficePoint(point, "north-east");

    expect(southEastPoint.x).not.toBe(northWestPoint.x);
    expect(southEastPoint.y).not.toBe(northWestPoint.y);
    expect(northEastPoint.x).not.toBe(southEastPoint.x);
  });

  it("maps office team ids to human-readable localized labels", () => {
    expect(officeTeamLabel("quant_strategy_desk", "en")).toBe(
      "Quant Strategy Desk",
    );
    expect(officeTeamLabel("knowledge_curation_desk", "ko")).toBe(
      "지식 큐레이션 데스크",
    );
  });

  it("falls back to the raw team id when the office team is unknown", () => {
    expect(officeTeamLabel("custom_team", "en")).toBe("custom_team");
  });
});
