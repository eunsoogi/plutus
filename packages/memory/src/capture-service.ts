import { CapturePolicy } from "./policy";
import { inferTags } from "./utils";
import type { MemoryCandidate, SourceRef } from "./schema";
import type { MemoryStore } from "./store";
import type { MemoryRecord } from "./store-types";

export class MemoryCaptureService {
  constructor(private readonly store: MemoryStore) {}

  async captureCompletedRun(input: {
    runId: string;
    runCard: string;
    findings: string[];
    sourceRefs: SourceRef[];
  }): Promise<{
    captured: MemoryRecord[];
    blocked: string[];
    skipped: string[];
  }> {
    const candidates = [
      ...input.findings.map(
        (finding): MemoryCandidate => ({
          kind: "research_memory",
          summary: finding,
          semanticText: finding,
          tags: inferTags(finding),
          sourceRefs: input.sourceRefs,
          sensitivityClass: "normal",
          retentionClass: "default",
        }),
      ),
      {
        kind: "workflow_memory",
        summary: "Completed run card contained blocked sensitive content.",
        semanticText: input.runCard,
        tags: ["run_card"],
        sourceRefs: input.sourceRefs,
        sensitivityClass: "normal",
        retentionClass: "temporary",
      } satisfies MemoryCandidate,
    ];
    const captured: MemoryRecord[] = [];
    const blocked: string[] = [];
    const skipped: string[] = [];
    for (const candidate of candidates) {
      const result = await this.store.capture(candidate, {
        policy: new CapturePolicy(),
        actor: "agent:report_writer",
        runId: input.runId,
        auditRef: `audit:${input.runId}`,
      });
      if (result.status === "captured") captured.push(result.record);
      if (result.status === "blocked") blocked.push(result.reason);
      if (result.status === "skipped") skipped.push(result.reason);
    }
    return { captured, blocked, skipped };
  }
}
