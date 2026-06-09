import { isSessionStale } from "./session";
import type { RemoteCommand } from "./schemas";
import type {
  RemoteCommandRequest,
  RemoteCommandResponse,
  RemoteControlStore,
  RemoteSession,
} from "./types";

export function requiresUnlock(command: RemoteCommand): boolean {
  return [
    "portfolio.update_position_thesis",
    "watchlist.update_item",
    "run.start",
    "run.cancel",
    "artifact.get",
    "wiki.get",
  ].includes(command.type);
}

export function isUnlocked(session: RemoteSession, at: Date): boolean {
  return (
    !session.unlockRequired ||
    (!!session.unlockedUntil &&
      new Date(session.unlockedUntil).getTime() >= at.getTime())
  );
}

export function permissionForRemoteCommand(
  store: RemoteControlStore,
  request: RemoteCommandRequest,
  at: Date,
): RemoteCommandResponse["permission"] {
  if (!store.enabled) return { status: "disabled", deviceId: request.deviceId };
  if (store.hostKillSwitch.active) {
    return {
      status: "host_kill_switch",
      deviceId: request.deviceId,
      reason: store.hostKillSwitch.reason,
    };
  }
  const session = store.sessions.find(
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
  if (isSessionStale(session, at)) {
    return { status: "stale", deviceId: request.deviceId };
  }
  if (requiresUnlock(request.command) && !isUnlocked(session, at)) {
    return { status: "unlock_required", deviceId: request.deviceId };
  }
  return { status: "allowed", deviceId: request.deviceId };
}
