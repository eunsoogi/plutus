import { RemoteDeviceSchema, RemoteSessionSchema } from "@plutus/domain";

import { fixtureIds, fixtureNow } from "./ids";

const permissions = {
  allowedCommandGroups: [
    "portfolio",
    "watchlist",
    "run",
    "artifact",
    "memory",
    "wiki",
  ],
} as const;

const device = (
  id: string,
  name: string,
  platform: "ios" | "android",
  revokedAt: string | null,
) =>
  RemoteDeviceSchema.parse({
    id,
    profileId: fixtureIds.profile,
    deviceName: name,
    devicePlatform: platform,
    publicKey: `fixture-public-key-${id}`,
    permissions,
    pairedAt: fixtureNow,
    lastSeenAt: revokedAt ? "2026-05-16T22:00:00.000Z" : fixtureNow,
    revokedAt,
  });

export const remoteDevices = [
  {
    device: device(fixtureIds.connectedDevice, "Connected iPhone", "ios", null),
    session: RemoteSessionSchema.parse({
      id: fixtureIds.connectedSession,
      remoteDeviceId: fixtureIds.connectedDevice,
      status: "connected",
      hostAddress: "plutus-mac.local:4173",
      startedAt: fixtureNow,
      lastHeartbeatAt: fixtureNow,
      endedAt: null,
    }),
  },
  {
    device: device(fixtureIds.staleDevice, "Stale Android", "android", null),
    session: RemoteSessionSchema.parse({
      id: fixtureIds.staleSession,
      remoteDeviceId: fixtureIds.staleDevice,
      status: "stale",
      hostAddress: "plutus-mac.local:4173",
      startedAt: "2026-05-16T23:00:00.000Z",
      lastHeartbeatAt: "2026-05-16T23:10:00.000Z",
      endedAt: null,
    }),
  },
  {
    device: device(
      fixtureIds.revokedDevice,
      "Revoked iPhone",
      "ios",
      "2026-05-16T22:30:00.000Z",
    ),
    session: RemoteSessionSchema.parse({
      id: fixtureIds.revokedSession,
      remoteDeviceId: fixtureIds.revokedDevice,
      status: "revoked",
      hostAddress: "plutus-mac.local:4173",
      startedAt: "2026-05-16T22:00:00.000Z",
      lastHeartbeatAt: "2026-05-16T22:20:00.000Z",
      endedAt: "2026-05-16T22:30:00.000Z",
    }),
  },
] as const;
