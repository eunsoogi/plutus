import { describe, expect, it } from "vitest";
import { officeMotionModeForRunStatus } from "./orchestrator-office-motion";

describe("officeMotionModeForRunStatus", () => {
  it("keeps all in-flight research statuses active", () => {
    const activeStatuses = [
      "active",
      "planning",
      "executing",
      "running",
      "grounding",
      "debating",
      "validating",
      "reporting",
    ] as const;

    for (const status of activeStatuses) {
      expect(officeMotionModeForRunStatus(status)).toBe("active");
    }
  });

  it("keeps queued and terminal statuses idle", () => {
    const idleStatuses = ["completed", "queued", "ready"] as const;

    for (const status of idleStatuses) {
      expect(officeMotionModeForRunStatus(status)).toBe("idle");
    }
  });
});
