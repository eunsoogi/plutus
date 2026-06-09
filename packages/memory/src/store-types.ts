import type { MemoryCandidate } from "./schema";
import type { CapturePolicy } from "./policy";

export interface MemoryRecord extends MemoryCandidate {
  id: string;
  profileId: string;
  mem0Id?: string;
  body: string;
  status: "active" | "archived" | "deleted";
  capturePolicy:
    | "auto_default"
    | "auto_high_value"
    | "manual_user_created"
    | "system_imported";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  lastRecalledAt?: string;
}

export interface MemoryActivity {
  id: string;
  memoryId?: string;
  eventType:
    | "captured"
    | "recalled"
    | "updated"
    | "pinned"
    | "archived"
    | "deleted"
    | "category_disabled"
    | "category_enabled";
  actor: string;
  runId?: string;
  auditRef?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type CaptureCandidateResult =
  | { status: "captured"; record: MemoryRecord }
  | { status: "skipped"; reason: string }
  | { status: "blocked"; reason: string };

export type CaptureOptions = {
  policy: CapturePolicy;
  actor: string;
  runId?: string;
  auditRef?: string;
};
