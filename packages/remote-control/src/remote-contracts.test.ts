import { describe, expect, it } from "vitest";
import { RemoteCommandSchema, remoteEventNames } from "./index";

describe("RemoteCommandSchema", () => {
  it("validates the MVP mobile command surface", () => {
    const parsed = RemoteCommandSchema.parse({
      type: "portfolio.update_position_thesis",
      payload: {
        portfolioId: "11111111-1111-4111-8111-111111111111",
        positionId: "22222222-2222-4222-8222-222222222222",
        thesis:
          "BTC and NVDA exposure remains within the Core portfolio guardrails.",
      },
    });

    expect(parsed.type).toBe("portfolio.update_position_thesis");
    expect(() =>
      RemoteCommandSchema.parse({ type: "portfolio.delete", portfolioId: "x" }),
    ).toThrow();
  });
});

describe("remote events", () => {
  it("includes connection, permission, warning, artifact, and run progress events", () => {
    expect(remoteEventNames).toEqual(
      expect.arrayContaining([
        "run.status_changed",
        "artifact.created",
        "warning.registered",
        "remote.device_connected",
        "remote.device_disconnected",
        "remote.permission_denied",
      ]),
    );
  });
});
