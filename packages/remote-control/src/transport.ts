import type {
  RemoteAddressMetadata,
  RemoteTransportMetadata,
} from "./types";

export function stableDigest(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function defaultDiscoveryAddress(): RemoteAddressMetadata {
  return {
    source: "discovery",
    host: "plutus.local",
    port: 7420,
    label: "local discovery",
  };
}

export function validateAddress(
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

export function createSessionKeyRef(seed: string): string {
  const cleaned = seed.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36) || "session";
  return `secure://plutus/remote-control/session-keys/${cleaned}`;
}

export function createTransportMetadata(
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

export function createSessionKey(deviceId: string, at: Date): string {
  const cleaned =
    deviceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || "device";
  return `enc:v1:${stableDigest(`${cleaned}:${at.toISOString()}`)}`;
}
