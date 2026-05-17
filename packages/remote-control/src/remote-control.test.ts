import { describe, expect, it } from "vitest";
import {
  RemoteCommandSchema,
  RemoteControlHost,
  createMemoryRemoteControlStore,
  isSessionStale,
  remoteEventNames,
} from "./index";

const now = new Date("2026-05-17T00:00:00.000Z");
const device = {
  id: "device-1",
  name: "Eunsoo iPhone",
  platform: "ios" as const,
};

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

describe("RemoteControlHost", () => {
  it("pairs a device with a short-lived code and rejects code reuse", async () => {
    const host = new RemoteControlHost({
      store: createMemoryRemoteControlStore(now),
      now: () => now,
    });

    const pairing = await host.enablePairing({ hostName: "Plutus Mac" });
    const session = await host.pairDevice({ code: pairing.code, device });

    expect(pairing.code).toMatch(/^[0-9]{6}$/);
    expect(session.sessionKey).toMatch(/^plutus_session_/);
    expect(session.deviceId).toBe(device.id);
    await expect(
      host.pairDevice({ code: pairing.code, device }),
    ).rejects.toThrow("Pairing code is not active");
  });

  it("blocks stale sessions, revoked devices, and host kill-switch mutations", async () => {
    const store = createMemoryRemoteControlStore(now);
    const host = new RemoteControlHost({ store, now: () => now });
    const pairing = await host.enablePairing({ hostName: "Plutus Mac" });
    const session = await host.pairDevice({ code: pairing.code, device });

    await host.recordHeartbeat({
      deviceId: device.id,
      at: new Date("2026-05-16T23:55:00.000Z"),
    });
    expect(isSessionStale(session, new Date("2026-05-17T00:04:59.000Z"))).toBe(
      false,
    );
    expect(isSessionStale(session, new Date("2026-05-17T00:06:01.000Z"))).toBe(
      true,
    );

    const stale = await host.execute(
      {
        commandId: "cmd-stale",
        deviceId: device.id,
        sessionKey: session.sessionKey,
        command: {
          type: "watchlist.update_item",
          payload: {
            itemId: "33333333-3333-4333-8333-333333333333",
            triggerNote: "trim",
          },
        },
      },
      async () => ({ ok: true }),
      new Date("2026-05-17T00:06:01.000Z"),
    );

    expect(stale.success).toBe(false);
    expect(stale.permission.status).toBe("stale");
    expect(stale.data).toBeNull();

    await host.recordHeartbeat({ deviceId: device.id, at: now });
    await host.revokeDevice(device.id, "user revoked access");
    const revoked = await host.execute(
      {
        commandId: "cmd-revoked",
        deviceId: device.id,
        sessionKey: session.sessionKey,
        command: { type: "portfolio.list" },
      },
      async () => ({ ok: true }),
      now,
    );

    expect(revoked.permission.status).toBe("revoked");
    expect(revoked.success).toBe(false);

    await host.setEnabled(false);
    const disabled = await host.execute(
      {
        commandId: "cmd-disabled",
        deviceId: device.id,
        sessionKey: session.sessionKey,
        command: { type: "portfolio.list" },
      },
      async () => ({ ok: true }),
      now,
    );
    expect(disabled.permission.status).toBe("disabled");
  });

  it("wraps successful command output with permission, warnings, and host timestamp", async () => {
    const host = new RemoteControlHost({
      store: createMemoryRemoteControlStore(now),
      now: () => now,
    });
    const pairing = await host.enablePairing({ hostName: "Plutus Mac" });
    const session = await host.pairDevice({ code: pairing.code, device });

    const response = await host.execute(
      {
        commandId: "cmd-ok",
        deviceId: device.id,
        sessionKey: session.sessionKey,
        command: { type: "portfolio.list" },
      },
      async () => ({ portfolios: [{ id: "core", name: "Core" }] }),
      now,
    );

    expect(response).toMatchObject({
      commandId: "cmd-ok",
      success: true,
      warnings: [],
      hostTimestamp: now.toISOString(),
      permission: { status: "allowed", deviceId: device.id },
      data: { portfolios: [{ id: "core", name: "Core" }] },
    });
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
