import { RemoteCommandSchema, type RemoteCommand } from "./schemas";
import { permissionForRemoteCommand } from "./permissions";
import {
  createSessionKey,
  createSessionKeyRef,
  createTransportMetadata,
  defaultDiscoveryAddress,
  validateAddress,
} from "./transport";
import type {
  RemoteAddressMetadata,
  RemoteCommandRequest,
  RemoteCommandResponse,
  RemoteControlStore,
  RemoteDeviceIdentity,
  RemoteSession,
  RemoteUnlockMethod,
} from "./types";

const pairingTtlMs = 2 * 60 * 1000;

function createPairingDigits(seed: number): string {
  return String(Math.abs(seed) % 1_000_000).padStart(6, "0");
}

export class RemoteControlHost {
  private store: RemoteControlStore;
  private now: () => Date;

  constructor(input: { store: RemoteControlStore; now?: () => Date }) {
    this.store = input.store;
    this.now = input.now ?? (() => new Date());
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.store.enabled = enabled;
    this.store.audit.push({
      type: enabled ? "remote.enabled" : "remote.disabled",
      at: this.now().toISOString(),
    });
  }

  async setHostKillSwitch(active: boolean, reason?: string): Promise<void> {
    const at = this.now();
    this.store.hostKillSwitch = {
      active,
      reason,
      updatedAt: at.toISOString(),
    };
    this.store.audit.push({
      type: active
        ? "remote.host_kill_switch_enabled"
        : "remote.host_kill_switch_disabled",
      at: at.toISOString(),
      reason,
    });
  }

  async enablePairing(input: {
    hostName: string;
    address?: RemoteAddressMetadata;
  }): Promise<{
    code: string;
    expiresAt: string;
    address: RemoteAddressMetadata;
  }> {
    this.store.enabled = true;
    const at = this.now();
    const address = validateAddress(input.address ?? defaultDiscoveryAddress());
    const code = createPairingDigits(
      at.getTime() + this.store.pairingCodes.length + 314159,
    );
    this.store.pairingCodes.push({
      code,
      hostName: input.hostName,
      address,
      expiresAt: new Date(at.getTime() + pairingTtlMs).toISOString(),
      consumed: false,
    });
    this.store.audit.push({
      type: "remote.pairing_code_created",
      at: at.toISOString(),
    });
    return {
      code,
      expiresAt: this.store.pairingCodes.at(-1)?.expiresAt ?? "",
      address,
    };
  }

  async pairDevice(input: {
    code: string;
    device: RemoteDeviceIdentity;
  }): Promise<RemoteSession> {
    if (!this.store.enabled) throw new Error("Remote control is disabled");
    if (this.store.hostKillSwitch.active) {
      throw new Error("Remote control host kill switch is active");
    }
    const at = this.now();
    const pairing = this.store.pairingCodes.find(
      (candidate) =>
        candidate.code === input.code &&
        !candidate.consumed &&
        new Date(candidate.expiresAt).getTime() >= at.getTime(),
    );
    if (!pairing) throw new Error("Pairing code is not active");
    pairing.consumed = true;
    const sessionKeyRef = createSessionKeyRef(
      `${input.device.id}-${at.getTime()}`,
    );
    const session: RemoteSession = {
      ...input.device,
      deviceId: input.device.id,
      sessionKey: createSessionKey(input.device.id, at),
      sessionKeyRef,
      transport: createTransportMetadata(pairing.address, sessionKeyRef),
      pairedAt: at.toISOString(),
      lastHeartbeatAt: at.toISOString(),
      status: "connected",
      unlockRequired: true,
    };
    this.store.sessions = [
      ...this.store.sessions.filter(
        (existing) => existing.id !== input.device.id,
      ),
      session,
    ];
    this.store.audit.push({
      type: "remote.device_connected",
      deviceId: input.device.id,
      at: at.toISOString(),
    });
    return session;
  }

  async unlockSession(input: {
    deviceId: string;
    sessionKey: string;
    sessionKeyRef: string;
    method: RemoteUnlockMethod;
    at?: Date;
    ttlMs?: number;
  }): Promise<void> {
    const at = input.at ?? this.now();
    const session = this.store.sessions.find(
      (candidate) => candidate.id === input.deviceId,
    );
    if (
      !session ||
      session.sessionKey !== input.sessionKey ||
      session.sessionKeyRef !== input.sessionKeyRef
    ) {
      throw new Error("invalid_session");
    }
    if (input.method !== "biometric") {
      throw new Error("unlock method is not allowed");
    }
    session.unlockedUntil = new Date(
      at.getTime() + (input.ttlMs ?? 60_000),
    ).toISOString();
    this.store.audit.push({
      type: "remote.session_unlocked",
      deviceId: input.deviceId,
      at: at.toISOString(),
    });
  }

  async recordHeartbeat(input: { deviceId: string; at?: Date }): Promise<void> {
    const session = this.store.sessions.find(
      (candidate) => candidate.id === input.deviceId,
    );
    if (session && session.status === "connected") {
      session.lastHeartbeatAt = (input.at ?? this.now()).toISOString();
    }
  }

  async revokeDevice(deviceId: string, reason: string): Promise<void> {
    const at = this.now();
    const session = this.store.sessions.find(
      (candidate) => candidate.id === deviceId,
    );
    if (session) {
      session.status = "revoked";
      session.revokedReason = reason;
    }
    this.store.audit.push({
      type: "remote.device_revoked",
      deviceId,
      reason,
      at: at.toISOString(),
    });
  }

  async execute<T>(
    request: RemoteCommandRequest,
    handler: (command: RemoteCommand) => Promise<T>,
    at = this.now(),
  ): Promise<RemoteCommandResponse<T>> {
    const parsed = RemoteCommandSchema.parse(request.command);
    const permission = permissionForRemoteCommand(this.store, request, at);
    if (permission.status !== "allowed") {
      this.store.audit.push({
        type: "remote.permission_denied",
        deviceId: request.deviceId,
        at: at.toISOString(),
        reason: permission.status,
      });
      return {
        commandId: request.commandId,
        success: false,
        data: null,
        warnings: [`Remote command denied: ${permission.status}`],
        hostTimestamp: at.toISOString(),
        permission,
      };
    }
    try {
      const data = await handler(parsed);
      return {
        commandId: request.commandId,
        success: true,
        data,
        warnings: [],
        hostTimestamp: at.toISOString(),
        permission,
      };
    } catch (error) {
      return {
        commandId: request.commandId,
        success: false,
        data: null,
        warnings: [
          error instanceof Error ? error.message : "Remote command failed",
        ],
        hostTimestamp: at.toISOString(),
        permission,
      };
    }
  }

  listSessions(): RemoteSession[] {
    return [...this.store.sessions];
  }
}
