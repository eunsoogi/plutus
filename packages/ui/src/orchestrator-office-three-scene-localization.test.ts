import { describe, expect, it } from "vitest";
import { officeCopy } from "./orchestrator-office-copy";
import { createOfficeThreeSceneCatalog } from "./orchestrator-office-three-scene";

describe("office Three.js scene localization", () => {
  it("localizes active team labels while keeping stable semantic ids", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "ko",
      stage: officeCopy.ko.stage.planning,
      teamId: "knowledge_curation_desk",
    });
    const objects = contract.scene.objects;
    const agentIds = objects
      .filter((object) => object.kind === "agent")
      .map((object) => object.id);

    expect(agentIds).toEqual([
      "agent:orchestrator",
      "agent:llm_wiki_curator",
      "agent:report_writer",
    ]);

    const commandDesk = objects.find(
      (object) => object.id === "desk:command_table",
    );
    expect(commandDesk?.label).toBe(officeCopy.ko.station.command_table);

    const wikiAgent = objects.find(
      (object) => object.id === "agent:llm_wiki_curator",
    );
    expect(wikiAgent?.kind).toBe("agent");
    if (wikiAgent?.kind !== "agent") return;
    expect(wikiAgent.label).toBe(officeCopy.ko.specialist.llm_wiki_curator);
    expect(wikiAgent.role).toBe(officeCopy.ko.station.market_desk);
    expect(wikiAgent.position).toHaveLength(3);
  });
});
