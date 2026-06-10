import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { officeCopy } from "./orchestrator-office-copy";
import { OrchestratorOfficeScene } from "./orchestrator-office-scene";
import { teamSpecialists } from "./orchestrator-office-teams";

describe("ui office Three renderer", () => {
  it("renders the office scene through an accessible Three canvas shell", () => {
    const englishOffice = officeCopy.en;
    const markup = renderToStaticMarkup(
      createElement(OrchestratorOfficeScene, {
        angle: 0,
        canvasChromeLabels: englishOffice.canvasChrome,
        motionMode: "active",
        onAngleDrag: () => {},
        orchestratorLabel: englishOffice.orchestrator,
        rotation: "south-east",
        specialistLabels: englishOffice.specialist,
        specialists: teamSpecialists.quant_strategy_desk,
        stage: englishOffice.stage.executing,
        stationLabels: englishOffice.station,
        teamLabel: "Quant Strategy Desk",
      }),
    );

    expect(markup).toContain('data-testid="orchestrator-office-canvas"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-office-renderer="three"');
    expect(markup).toContain('data-office-motion-mode="active"');
    const meshCount = markup.match(/data-office-mesh-count="(?<meshCount>\d+)"/)
      ?.groups?.meshCount;
    expect(meshCount).toBeDefined();
    expect(Number(meshCount)).toBeGreaterThanOrEqual(20);
    expect(markup).toContain("data-office-camera=");
    expect(markup).toContain('data-office-rotation="south-east"');
    expect(markup).toContain("Market Data Researcher");
    expect(markup).toContain("Research Orchestrator");
    expect(markup).not.toContain("<svg");
  });
});
