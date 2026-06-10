import type { OfficeThreeMotionMode } from "./orchestrator-office-three-types";

const idleRunStatuses: ReadonlySet<string> = new Set([
  "completed",
  "queued",
  "ready",
]);
const activeRunStatuses: ReadonlySet<string> = new Set([
  "active",
  "debating",
  "executing",
  "grounding",
  "planning",
  "reporting",
  "running",
  "validating",
]);

export function officeMotionModeForRunStatus(
  status: string,
): OfficeThreeMotionMode {
  const normalizedStatus = status.trim().toLowerCase();
  if (activeRunStatuses.has(normalizedStatus)) return "active";
  if (idleRunStatuses.has(normalizedStatus)) return "idle";
  return "idle";
}
