import type { LocalToolCall, LocalToolRunContext } from "../context";

export interface AuditEvent {
  auditRef: string;
  decision: "accepted" | "rejected";
  runId: string;
  profileId: string;
  agentName: string;
  namespace: string;
  tool: string;
  reason?: string;
  at: string;
}

export interface InMemoryToolRuntime {
  auditEvents: AuditEvent[];
  records: Map<string, unknown>;
  storageRoot?: string;
  log: (
    context: LocalToolRunContext,
    call: LocalToolCall,
    decision: "accepted" | "rejected",
    reason?: string,
  ) => string;
}

export function createInMemoryToolRuntime(
  options: { storageRoot?: string } = {},
): InMemoryToolRuntime {
  const auditEvents: AuditEvent[] = [];
  return {
    auditEvents,
    records: new Map<string, unknown>(),
    storageRoot: options.storageRoot,
    log(context, call, decision, reason) {
      const auditRef = `audit_${String(auditEvents.length + 1).padStart(4, "0")}`;
      auditEvents.push({
        auditRef,
        decision,
        runId: context.runId,
        profileId: context.profileId,
        agentName: context.agentName,
        namespace: call.namespace,
        tool: call.tool,
        reason,
        at: new Date(0).toISOString(),
      });
      return auditRef;
    },
  };
}
