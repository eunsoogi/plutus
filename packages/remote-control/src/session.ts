import { RemoteCommandSchema, type RemoteCommand } from "./schemas";
import {
  createSessionKeyRef,
  createTransportMetadata,
  defaultDiscoveryAddress,
} from "./transport";
import type {
  PairingSession,
  RemoteControlStore,
  RemoteSession,
} from "./types";

const staleAfterMs = 10 * 60 * 1000;

export function createMemoryRemoteControlStore(
  now = new Date(),
): RemoteControlStore {
  return {
    enabled: false,
    hostKillSwitch: {
      active: false,
      updatedAt: now.toISOString(),
    },
    pairingCodes: [],
    sessions: [],
    audit: [{ type: "remote.store_created", at: now.toISOString() }],
  };
}

export function isSessionStale(
  session: RemoteSession,
  at = new Date(),
): boolean {
  return (
    at.getTime() - new Date(session.lastHeartbeatAt).getTime() > staleAfterMs
  );
}

export function createPairingCode(hostId = "mac-host-fixture") {
  const keyRef = createSessionKeyRef(hostId);
  return {
    hostId,
    qrPayload: `plutus://pair/${hostId}/123456`,
    shortCode: "123456",
    address: defaultDiscoveryAddress(),
    sessionKeyRef: keyRef,
    transport: createTransportMetadata(defaultDiscoveryAddress(), keyRef),
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  };
}

export function pairDevice(shortCode: string): PairingSession {
  if (shortCode !== "123456") {
    throw new Error("invalid_pairing_code");
  }
  return {
    deviceId: "018f3f5d-0000-7000-8000-000000000008",
    hostId: "mac-host-fixture",
    state: "connected",
    sessionKey: "enc:v1:encrypted-session-key-fixture",
    sessionKeyRef: "secure://plutus/remote-control/session-keys/fixture",
    transport: createTransportMetadata(
      defaultDiscoveryAddress(),
      "secure://plutus/remote-control/session-keys/fixture",
    ),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    canMutate: true,
    unlockRequired: true,
  };
}

export function revokeDevice(session: PairingSession): PairingSession {
  return { ...session, state: "revoked", canMutate: false };
}

export function markStale(session: PairingSession): PairingSession {
  return { ...session, state: "stale", canMutate: false };
}

export function authorizeRemoteCommand(
  session: PairingSession,
  command: RemoteCommand,
) {
  RemoteCommandSchema.parse(command);
  if (session.state === "revoked")
    return { allowed: false, reason: "device_revoked" };
  if (session.state === "stale")
    return { allowed: false, reason: "host_unreachable" };
  const mutation = [
    "portfolio.update_position_thesis",
    "watchlist.update_item",
    "run.start",
    "run.cancel",
  ].includes(command.type);
  if (mutation && !session.canMutate)
    return { allowed: false, reason: "mutation_denied" };
  return { allowed: true, reason: "allowed" };
}
