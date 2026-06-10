import { describe, expect, it } from "vitest";
import { officeCopy } from "./orchestrator-office-copy";
import { createOfficeThreeSceneCatalog } from "./orchestrator-office-three-scene";

describe("office Three.js scene motion contract", () => {
  it("passes explicit motion mode into the renderer contract", () => {
    const activeContract = createOfficeThreeSceneCatalog({
      motionMode: "active",
      stage: "Executing",
    });
    const idleContract = createOfficeThreeSceneCatalog({
      stage: officeCopy.en.stage.planning,
    });

    expect(activeContract.scene.motion.mode).toBe("active");
    expect(idleContract.scene.motion.mode).toBe("idle");
  });
});
