import { describe, expect, it } from "vitest";
import "./remote-contracts.test";
import {
  RemoteControlHost,
  createMemoryRemoteControlStore,
  isSessionStale,
} from "./index";

const now = new Date("2026-05-17T00:00:00.000Z");
const device = {
  id: "device-1",
  name: "Eunsoo iPhone",
  platform: "ios" as const,
};

describe("RemoteControlHost", () => {
  it("pairs a device with a short-lived code and rejects code reuse", async () => {
    const host = new RemoteControlHost({
      store: createMemoryRemoteControlStore(now),
      now: () => now,
    });

    const pairing = await host.enablePairing({ hostName: "Plutus Mac" });
    const session = await host.pairDevice({ code: pairing.code, device });

    expect(pairing.code).toMatch(/^[0-9]{6}$/);
    expect(session.sessionKey).toMatch(/^enc:v1:/);
    expect(session.sessionKeyRef).toMatch(
      /^secure:\/\/plutus\/remote-control\/session-keys\//,
    );
    expect(session.deviceId).toBe(device.id);
    await expect(
      host.pairDevice({ code: pairing.code, device }),
    ).rejects.toThrow("Pairing code is not active");
  });

  it("persists manual address provenance and encrypted transport metadata", async () => {
    const host = new RemoteControlHost({
      store: createMemoryRemoteControlStore(now),
      now: () => now,
    });

    const pairing = await host.enablePairing({
      hostName: "Plutus Mac",
      address: {
        source: "manual",
        host: "192.168.1.20",
        port: 7420,
        label: "home lan",
      },
    });
    const session = await host.pairDevice({ code: pairing.code, device });

    expect(pairing.address).toMatchObject({
      source: "manual",
      host: "192.168.1.20",
      port: 7420,
    });
    expect(session.transport).toMatchObject({
      scheme: "wss",
      address: {
        source: "manual",
        host: "192.168.1.20",
        port: 7420,
      },
      encryption: {
        cipherSuite: "x25519-chacha20poly1305",
        sessionKeyRef: session.sessionKeyRef,
      },
    });
    expect(session.transport.encryption.handshakeHash).toMatch(/^sha256:/);

    await expect(
      host.enablePairing({
        hostName: "Plutus Mac",
        address: { source: "discovery", host: "", port: 7420 },
      }),
    ).rejects.toThrow("remote host address is required");
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
        sessionKeyRef: session.sessionKeyRef,
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
        sessionKeyRef: session.sessionKeyRef,
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
        sessionKeyRef: session.sessionKeyRef,
        command: { type: "portfolio.list" },
      },
      async () => ({ ok: true }),
      now,
    );
    expect(disabled.permission.status).toBe("disabled");
  });

  it("enforces the host kill switch and biometric unlock for sensitive commands", async () => {
    const host = new RemoteControlHost({
      store: createMemoryRemoteControlStore(now),
      now: () => now,
    });
    const pairing = await host.enablePairing({ hostName: "Plutus Mac" });
    const session = await host.pairDevice({ code: pairing.code, device });

    const locked = await host.execute(
      {
        commandId: "cmd-locked",
        deviceId: device.id,
        sessionKey: session.sessionKey,
        sessionKeyRef: session.sessionKeyRef,
        command: {
          type: "run.start",
          payload: {
            portfolioId: "core",
            userRequest: "review portfolio risk",
          },
        },
      },
      async () => ({ ok: true }),
      now,
    );
    expect(locked.permission.status).toBe("unlock_required");

    await host.unlockSession({
      deviceId: device.id,
      sessionKey: session.sessionKey,
      sessionKeyRef: session.sessionKeyRef,
      method: "biometric",
      at: now,
    });
    const unlocked = await host.execute(
      {
        commandId: "cmd-unlocked",
        deviceId: device.id,
        sessionKey: session.sessionKey,
        sessionKeyRef: session.sessionKeyRef,
        command: {
          type: "run.start",
          payload: {
            portfolioId: "core",
            userRequest: "review portfolio risk",
          },
        },
      },
      async () => ({ ok: true }),
      now,
    );
    expect(unlocked.permission.status).toBe("allowed");
    expect(unlocked.success).toBe(true);

    await host.setHostKillSwitch(true, "owner disabled remote access");
    const killed = await host.execute(
      {
        commandId: "cmd-killed",
        deviceId: device.id,
        sessionKey: session.sessionKey,
        sessionKeyRef: session.sessionKeyRef,
        command: { type: "portfolio.list" },
      },
      async () => ({ ok: true }),
      now,
    );
    expect(killed.permission).toMatchObject({
      status: "host_kill_switch",
      reason: "owner disabled remote access",
    });
    expect(killed.success).toBe(false);
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
        sessionKeyRef: session.sessionKeyRef,
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
