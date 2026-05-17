import { z } from "zod";

const UuidSchema = z.string().uuid();

export const UpdatePositionThesisInputSchema = z.object({
  portfolioId: UuidSchema,
  positionId: UuidSchema,
  thesis: z.string().min(1),
});

export const UpdateWatchlistItemInputSchema = z.object({
  itemId: UuidSchema,
  note: z.string().min(1).max(4000).optional(),
  triggerNote: z.string().min(1).max(4000).optional(),
});

export const StartResearchRunInputSchema = z.object({
  profileId: z.string().uuid().optional(),
  portfolioId: z.string().min(1),
  symbols: z.array(z.string().min(1)).min(1).optional(),
  thesis: z.string().min(1).optional(),
  userRequest: z.string().min(1).optional(),
});

export const RemoteCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("portfolio.list") }),
  z.object({ type: z.literal("portfolio.snapshot"), portfolioId: UuidSchema }),
  z.object({
    type: z.literal("portfolio.update_position_thesis"),
    payload: UpdatePositionThesisInputSchema,
  }),
  z.object({ type: z.literal("watchlist.list") }),
  z.object({
    type: z.literal("watchlist.update_item"),
    payload: UpdateWatchlistItemInputSchema,
  }),
  z.object({
    type: z.literal("run.start"),
    payload: StartResearchRunInputSchema,
  }),
  z.object({ type: z.literal("run.get"), runId: UuidSchema }),
  z.object({ type: z.literal("run.cancel"), runId: UuidSchema }),
  z.object({ type: z.literal("artifact.get"), artifactId: UuidSchema }),
  z.object({ type: z.literal("memory.activity") }),
  z.object({ type: z.literal("wiki.list") }),
  z.object({ type: z.literal("wiki.get"), pageId: UuidSchema }),
]);

export type RemoteCommand = z.infer<typeof RemoteCommandSchema>;
export type RemotePlatform = "ios" | "android";
export type RemotePermissionStatus =
  | "allowed"
  | "disabled"
  | "host_kill_switch"
  | "invalid_session"
  | "unlock_required"
  | "revoked"
  | "stale";
export type RemoteAddressSource = "manual" | "discovery";
export type RemoteUnlockMethod = "biometric";

export interface RemoteAddressMetadata {
  source: RemoteAddressSource;
  host: string;
  port: number;
  label?: string;
}

export interface RemoteTransportMetadata {
  scheme: "wss";
  address: RemoteAddressMetadata;
  encryption: {
    cipherSuite: "x25519-chacha20poly1305";
    handshakeHash: string;
    sessionKeyRef: string;
  };
}

export interface RemoteDeviceIdentity {
  id: string;
  name: string;
  platform: RemotePlatform;
}

export interface RemoteSession extends RemoteDeviceIdentity {
  deviceId: string;
  sessionKey: string;
  sessionKeyRef: string;
  transport: RemoteTransportMetadata;
  pairedAt: string;
  lastHeartbeatAt: string;
  status: "connected" | "revoked";
  unlockRequired: boolean;
  unlockedUntil?: string;
  revokedReason?: string;
}

export interface PairingSession {
  deviceId: string;
  hostId: string;
  state: "connected" | "stale" | "revoked";
  sessionKey: string;
  sessionKeyRef: string;
  transport: RemoteTransportMetadata;
  expiresAt: string;
  canMutate: boolean;
  unlockRequired: boolean;
}

interface PairingCode {
  code: string;
  hostName: string;
  address: RemoteAddressMetadata;
  expiresAt: string;
  consumed: boolean;
}

interface HostKillSwitch {
  active: boolean;
  reason?: string;
  updatedAt: string;
}

export interface RemoteControlStore {
  enabled: boolean;
  hostKillSwitch: HostKillSwitch;
  pairingCodes: PairingCode[];
  sessions: RemoteSession[];
  audit: Array<{
    type: string;
    deviceId?: string;
    at: string;
    reason?: string;
  }>;
}

export interface RemoteCommandRequest {
  commandId: string;
  deviceId: string;
  sessionKey: string;
  sessionKeyRef: string;
  command: RemoteCommand;
}

export interface RemoteCommandResponse<T = unknown> {
  commandId: string;
  success: boolean;
  data: T | null;
  warnings: string[];
  hostTimestamp: string;
  permission: {
    status: RemotePermissionStatus;
    deviceId?: string;
    reason?: string;
  };
}

const staleAfterMs = 10 * 60 * 1000;
const pairingTtlMs = 2 * 60 * 1000;

export const remoteEventNames = [
  "run.status_changed",
  "run.stage_started",
  "run.stage_completed",
  "agent.message",
  "tool.call_started",
  "tool.call_completed",
  "warning.registered",
  "artifact.created",
  "notification.created",
  "run.completed",
  "run.failed",
  "remote.device_connected",
  "remote.device_disconnected",
  "remote.permission_denied",
] as const;

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

function createPairingDigits(seed: number): string {
  return String(Math.abs(seed) % 1_000_000).padStart(6, "0");
}

function stableDigest(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function defaultDiscoveryAddress(): RemoteAddressMetadata {
  return {
    source: "discovery",
    host: "plutus.local",
    port: 7420,
    label: "local discovery",
  };
}

function validateAddress(
  address: RemoteAddressMetadata,
): RemoteAddressMetadata {
  if (!address.host.trim()) throw new Error("remote host address is required");
  if (
    !Number.isInteger(address.port) ||
    address.port < 1 ||
    address.port > 65535
  ) {
    throw new Error("remote host port is invalid");
  }
  if (!["manual", "discovery"].includes(address.source)) {
    throw new Error("remote host address source is invalid");
  }
  return { ...address, host: address.host.trim() };
}

function createSessionKeyRef(seed: string): string {
  const cleaned = seed.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36) || "session";
  return `secure://plutus/remote-control/session-keys/${cleaned}`;
}

function createTransportMetadata(
  address: RemoteAddressMetadata,
  sessionKeyRef: string,
): RemoteTransportMetadata {
  const validated = validateAddress(address);
  return {
    scheme: "wss",
    address: validated,
    encryption: {
      cipherSuite: "x25519-chacha20poly1305",
      handshakeHash: `sha256:${stableDigest(
        `${validated.source}:${validated.host}:${validated.port}:${sessionKeyRef}`,
      )}`,
      sessionKeyRef,
    },
  };
}

function createSessionKey(deviceId: string, at: Date): string {
  const cleaned =
    deviceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || "device";
  return `enc:v1:${stableDigest(`${cleaned}:${at.toISOString()}`)}`;
}

function requiresUnlock(command: RemoteCommand): boolean {
  return [
    "portfolio.update_position_thesis",
    "watchlist.update_item",
    "run.start",
    "run.cancel",
    "artifact.get",
    "wiki.get",
  ].includes(command.type);
}

function isUnlocked(session: RemoteSession, at: Date): boolean {
  return (
    !session.unlockRequired ||
    (!!session.unlockedUntil &&
      new Date(session.unlockedUntil).getTime() >= at.getTime())
  );
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
    transport: RemoteTransportMetadata;
  }> {
    this.store.enabled = true;
    const at = this.now();
    const address = validateAddress(input.address ?? defaultDiscoveryAddress());
    const previewKeyRef = createSessionKeyRef(
      `${input.hostName}-${at.getTime()}`,
    );
    const code = createPairingDigits(
      at.getTime() + this.store.pairingCodes.length + 314159,
    );
    const pairing = {
      code,
      hostName: input.hostName,
      address,
      expiresAt: new Date(at.getTime() + pairingTtlMs).toISOString(),
      consumed: false,
    };
    this.store.pairingCodes.push(pairing);
    this.store.audit.push({
      type: "remote.pairing_code_created",
      at: at.toISOString(),
    });
    return {
      code: pairing.code,
      expiresAt: pairing.expiresAt,
      address,
      transport: createTransportMetadata(address, previewKeyRef),
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
    const permission = this.permissionFor(request, at);
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

  private permissionFor(
    request: RemoteCommandRequest,
    at: Date,
  ): RemoteCommandResponse["permission"] {
    if (!this.store.enabled)
      return { status: "disabled", deviceId: request.deviceId };
    if (this.store.hostKillSwitch.active) {
      return {
        status: "host_kill_switch",
        deviceId: request.deviceId,
        reason: this.store.hostKillSwitch.reason,
      };
    }
    const session = this.store.sessions.find(
      (candidate) => candidate.id === request.deviceId,
    );
    if (
      !session ||
      session.sessionKey !== request.sessionKey ||
      session.sessionKeyRef !== request.sessionKeyRef
    ) {
      return { status: "invalid_session", deviceId: request.deviceId };
    }
    if (session.status === "revoked") {
      return {
        status: "revoked",
        deviceId: request.deviceId,
        reason: session.revokedReason,
      };
    }
    if (isSessionStale(session, at))
      return { status: "stale", deviceId: request.deviceId };
    if (requiresUnlock(request.command) && !isUnlocked(session, at)) {
      return { status: "unlock_required", deviceId: request.deviceId };
    }
    return { status: "allowed", deviceId: request.deviceId };
  }
}
