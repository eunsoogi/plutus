import { z } from "zod";

import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";
import { UpdatePositionThesisInputSchema } from "../portfolio/schema";
import { StartResearchRunInputSchema } from "../research-run/schema";
import { UpdateWatchlistItemInputSchema } from "../watchlist/schema";

export const RemoteDevicePlatform = z.enum(["ios", "android"]);
export const RemoteSessionStatus = z.enum([
  "pairing",
  "connected",
  "stale",
  "revoked",
]);
export const RemoteCommandGroup = z.enum([
  "portfolio",
  "watchlist",
  "run",
  "artifact",
  "memory",
  "wiki",
]);

export const RemoteDevicePermissionsSchema = z.object({
  allowedCommandGroups: z.array(RemoteCommandGroup),
});

export const RemoteDeviceSchema = z.object({
  id: UuidSchema,
  profileId: UuidSchema,
  deviceName: z.string().min(1),
  devicePlatform: RemoteDevicePlatform,
  publicKey: z.string().min(1),
  permissions: RemoteDevicePermissionsSchema,
  pairedAt: IsoUtcDateTimeSchema,
  lastSeenAt: IsoUtcDateTimeSchema.nullable(),
  revokedAt: IsoUtcDateTimeSchema.nullable(),
});

export const RemoteSessionSchema = z.object({
  id: UuidSchema,
  remoteDeviceId: UuidSchema,
  status: RemoteSessionStatus,
  hostAddress: z.string().min(1),
  startedAt: IsoUtcDateTimeSchema,
  lastHeartbeatAt: IsoUtcDateTimeSchema.nullable(),
  endedAt: IsoUtcDateTimeSchema.nullable(),
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

export const RemoteResponseSchema = z.object({
  commandId: UuidSchema,
  success: z.boolean(),
  data: z.unknown().optional(),
  warnings: z.array(z.string()),
  hostTimestamp: IsoUtcDateTimeSchema,
  permissionResult: z.object({
    allowed: z.boolean(),
    reason: z.string().optional(),
  }),
});

export type RemoteCommand = z.infer<typeof RemoteCommandSchema>;
export type RemoteDevice = z.infer<typeof RemoteDeviceSchema>;
export type RemoteSession = z.infer<typeof RemoteSessionSchema>;
export type RemoteDevicePermissions = z.infer<
  typeof RemoteDevicePermissionsSchema
>;
export type RemoteSessionStatus = z.infer<typeof RemoteSessionStatus>;

export type RemoteCommandAuthorization =
  | { allowed: true }
  | { allowed: false; reason: "session_not_connected" | "group_not_allowed" };

const commandGroupByPrefix: Record<
  string,
  z.infer<typeof RemoteCommandGroup>
> = {
  portfolio: "portfolio",
  watchlist: "watchlist",
  run: "run",
  artifact: "artifact",
  memory: "memory",
  wiki: "wiki",
};

export function getRemoteCommandGroup(
  command: RemoteCommand,
): z.infer<typeof RemoteCommandGroup> {
  const prefix = command.type.split(".")[0];
  return commandGroupByPrefix[prefix] ?? "portfolio";
}

export function validateRemoteCommandForSession(
  command: RemoteCommand,
  context: {
    sessionStatus: z.infer<typeof RemoteSessionStatus>;
    permissions: z.infer<typeof RemoteDevicePermissionsSchema>;
  },
): RemoteCommandAuthorization {
  if (context.sessionStatus !== "connected") {
    return { allowed: false, reason: "session_not_connected" };
  }

  const commandGroup = getRemoteCommandGroup(command);
  if (!context.permissions.allowedCommandGroups.includes(commandGroup)) {
    return { allowed: false, reason: "group_not_allowed" };
  }

  return { allowed: true };
}
