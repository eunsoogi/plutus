import type { RemoteCommand } from "./schemas";

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

export interface PairingCode {
  code: string;
  hostName: string;
  address: RemoteAddressMetadata;
  expiresAt: string;
  consumed: boolean;
}

export interface HostKillSwitch {
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
