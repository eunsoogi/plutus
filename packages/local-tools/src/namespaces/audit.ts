import { z } from "zod";
import type { InMemoryToolRuntime } from "../audit/in-memory-audit";
import type { LocalToolRunContext } from "../context";
import type { SourceRef } from "../schemas/envelope";
import { ok, warning, type NamespaceHandler } from "./common";

const AUDIT_RECORDS_KEY = "plutus_audit_records";
const AUDIT_TIMESTAMP = new Date(0).toISOString();

const auditSeveritySchema = z.enum(["info", "warning", "blocking"]);
const sourceRefInputSchema = z.object({
  id: z.string(),
  provider: z.string().optional(),
  title: z.string().optional(),
  url: z.string().url().optional(),
  asOf: z.string().datetime().optional(),
  retrievedAt: z.string().datetime().optional(),
});

const baseAuditRecordSchema = z.object({
  id: z.string(),
  runId: z.string(),
  profileId: z.string(),
  recordedBy: z.string(),
  at: z.string().datetime(),
});

const agentEventRecordSchema = baseAuditRecordSchema.extend({
  type: z.literal("agent_event"),
  agentName: z.string(),
  eventType: z.string(),
  payloadRef: z.string().optional(),
  payloadHash: z.string().optional(),
});

const toolProvenanceRecordSchema = baseAuditRecordSchema.extend({
  type: z.literal("tool_provenance"),
  toolName: z.string(),
  inputHash: z.string(),
  outputHash: z.string(),
  sourceRefs: z.array(sourceRefInputSchema),
});

const warningRecordSchema = baseAuditRecordSchema.extend({
  type: z.literal("warning"),
  warningType: z.string(),
  severity: auditSeveritySchema,
  message: z.string(),
  evidenceRefs: z.array(z.string()),
});

const auditRecordSchema = z.discriminatedUnion("type", [
  agentEventRecordSchema,
  toolProvenanceRecordSchema,
  warningRecordSchema,
]);
const auditRecordsSchema = z.array(auditRecordSchema);

const logAgentEventInputSchema = z.object({
  runId: z.string().optional(),
  agentName: z.string().optional(),
  eventType: z.string().min(1),
  payloadRef: z.string().optional(),
  payloadHash: z.string().optional(),
});

const logToolProvenanceInputSchema = z.object({
  runId: z.string().optional(),
  toolName: z.string().min(1),
  inputHash: z.string().min(1),
  outputHash: z.string().min(1),
  sourceRefs: z.array(sourceRefInputSchema).default([]),
});

const registerWarningInputSchema = z.object({
  runId: z.string().optional(),
  warningType: z.string().min(1),
  severity: auditSeveritySchema.default("warning"),
  message: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
});

const getRunAuditTrailInputSchema = z.object({
  runId: z.string().optional(),
});

type AuditRecord = z.infer<typeof auditRecordSchema>;
type AuditSourceRefInput = z.infer<typeof sourceRefInputSchema>;

export const handleAudit: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  switch (call.tool) {
    case "log_agent_event": {
      const input = logAgentEventInputSchema.parse(call.input);
      const record = appendAuditRecord(runtime, context, {
        type: "agent_event",
        runId: input.runId ?? context.runId,
        agentName: input.agentName ?? context.agentName,
        eventType: input.eventType,
        payloadRef: input.payloadRef,
        payloadHash: input.payloadHash,
      });
      return ok(auditRef, "plutus_audit", { event: record });
    }
    case "log_tool_provenance": {
      const input = logToolProvenanceInputSchema.parse(call.input);
      const record = appendAuditRecord(runtime, context, {
        type: "tool_provenance",
        runId: input.runId ?? context.runId,
        toolName: input.toolName,
        inputHash: input.inputHash,
        outputHash: input.outputHash,
        sourceRefs: input.sourceRefs.map(normalizeSourceRef),
      });
      return ok(auditRef, "plutus_audit", { provenance: record });
    }
    case "register_warning": {
      const input = registerWarningInputSchema.parse(call.input);
      const record = appendAuditRecord(runtime, context, {
        type: "warning",
        runId: input.runId ?? context.runId,
        warningType: input.warningType,
        severity: input.severity,
        message: input.message,
        evidenceRefs: input.evidenceRefs,
      });
      return ok(auditRef, "plutus_audit", { warning: record }, [
        warning(
          input.warningType,
          input.severity,
          input.message,
          input.evidenceRefs,
        ),
      ]);
    }
    case "get_run_audit_trail": {
      const input = getRunAuditTrailInputSchema.parse(call.input);
      const runId = input.runId ?? context.runId;
      return ok(auditRef, "plutus_audit", {
        runId,
        records: auditRecords(runtime).filter(
          (record) =>
            record.profileId === context.profileId && record.runId === runId,
        ),
        toolCalls: runtime.auditEvents.filter(
          (event) =>
            event.profileId === context.profileId && event.runId === runId,
        ),
      });
    }
    default:
      return ok(auditRef, "plutus_audit", undefined, [
        warning(
          "unsupported_audit_tool",
          "blocking",
          `${call.tool} is not implemented by plutus_audit.`,
        ),
      ]);
  }
};

function appendAuditRecord(
  runtime: InMemoryToolRuntime,
  context: LocalToolRunContext,
  input:
    | Omit<
        z.infer<typeof agentEventRecordSchema>,
        "id" | "profileId" | "recordedBy" | "at"
      >
    | Omit<
        z.infer<typeof toolProvenanceRecordSchema>,
        "id" | "profileId" | "recordedBy" | "at"
      >
    | Omit<
        z.infer<typeof warningRecordSchema>,
        "id" | "profileId" | "recordedBy" | "at"
      >,
): AuditRecord {
  const existing = auditRecords(runtime);
  const record = auditRecordSchema.parse({
    ...input,
    id: `audit_record_${String(existing.length + 1).padStart(4, "0")}`,
    profileId: context.profileId,
    recordedBy: context.agentName,
    at: AUDIT_TIMESTAMP,
  });
  runtime.records.set(AUDIT_RECORDS_KEY, [...existing, record]);
  return record;
}

function auditRecords(runtime: InMemoryToolRuntime): AuditRecord[] {
  const parsed = auditRecordsSchema.safeParse(
    runtime.records.get(AUDIT_RECORDS_KEY),
  );
  return parsed.success ? parsed.data : [];
}

function normalizeSourceRef(ref: AuditSourceRefInput): SourceRef {
  return {
    id: ref.id,
    provider: ref.provider ?? "plutus_audit",
    ...(ref.title ? { title: ref.title } : {}),
    ...(ref.url ? { url: ref.url } : {}),
    ...(ref.asOf ? { asOf: ref.asOf } : {}),
    retrievedAt: ref.retrievedAt ?? AUDIT_TIMESTAMP,
  };
}
