import { describe, expect, it } from "vitest";
import { fixtureIds } from "@plutus/test-fixtures";
import {
  authorizeRemoteCommand,
  createPairingCode,
  markStale,
  pairDevice,
  revokeDevice,
} from "./index";

describe("remote control protocol", () => {
  it("pairs, authorizes, revokes, and blocks stale sessions", () => {
    expect(createPairingCode().shortCode).toBe("123456");
    const session = pairDevice("123456");
    expect(
      authorizeRemoteCommand(session, { type: "portfolio.list" }).allowed,
    ).toBe(true);
    expect(
      authorizeRemoteCommand(revokeDevice(session), { type: "portfolio.list" })
        .reason,
    ).toBe("device_revoked");
    expect(
      authorizeRemoteCommand(markStale(session), {
        type: "run.start",
        payload: {
          portfolioId: fixtureIds.corePortfolio,
          userRequest: "review",
        },
      }).reason,
    ).toBe("host_unreachable");
  });
});
