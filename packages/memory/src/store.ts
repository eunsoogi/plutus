import { MemoryCandidateSchema, type MemoryCandidate, type MemoryKind } from "./schema";
import { FakeMem0Adapter, type Mem0Adapter, type Mem0SearchResult } from "./mem0-adapter";
import { CapturePolicy, SensitivityFilter } from "./policy";
import { createId, inferTags, relevance, tokenize } from "./utils";
import type { CaptureCandidateResult, CaptureOptions, MemoryActivity, MemoryRecord } from "./store-types";

export class MemoryStore {
  readonly activity: MemoryActivity[] = [];
  private readonly records = new Map<string, MemoryRecord>();
  private readonly filter = new SensitivityFilter();
  private readonly categoryToggles = new CapturePolicy();

  constructor(
    private readonly options: { adapter: Mem0Adapter; profileId?: string } = {
      adapter: new FakeMem0Adapter(),
    },
  ) {}

  capture(summary: string): MemoryRecord | null;
  capture(candidate: MemoryCandidate, options: CaptureOptions): Promise<CaptureCandidateResult>;
  capture(
    candidateOrSummary: MemoryCandidate | string,
    options?: CaptureOptions,
  ): MemoryRecord | null | Promise<CaptureCandidateResult> {
    if (typeof candidateOrSummary === "string") {
      return this.captureSummary(candidateOrSummary);
    }
    return this.captureCandidate(
      candidateOrSummary,
      options ?? { policy: new CapturePolicy(), actor: "system" },
    );
  }

  private captureSummary(summary: string): MemoryRecord | null {
    const sanitized = this.filter.sanitize(summary);
    if (sanitized.blocked || !this.categoryToggles.isCategoryEnabled("research_memory"))
      return null;
    const now = new Date().toISOString();
    const record: MemoryRecord = {
      id: createId(),
      profileId: this.options.profileId ?? "default",
      kind: "research_memory",
      summary: sanitized.text,
      body: sanitized.text,
      semanticText: sanitized.text,
      tags: inferTags(sanitized.text),
      sourceRefs: [],
      capturePolicy: "manual_user_created",
      sensitivityClass: "normal",
      retentionClass: "default",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(record.id, record);
    this.log({
      memoryId: record.id,
      eventType: "captured",
      actor: "user",
      payload: {},
    });
    return { ...record };
  }

  private async captureCandidate(
    candidate: MemoryCandidate,
    options: CaptureOptions,
  ): Promise<CaptureCandidateResult> {
    const parsed = MemoryCandidateSchema.parse(candidate);
    if (parsed.sensitivityClass === "secret_blocked") {
      return { status: "blocked", reason: "secret_blocked candidates are never written to Mem0." };
    }
    const sanitized = this.filter.sanitize(parsed.semanticText);
    if (sanitized.blocked) {
      return { status: "blocked", reason: sanitized.warnings[0] ?? "sensitive text blocked" };
    }
    if (!options.policy.isCategoryEnabled(parsed.kind) || !this.categoryToggles.isCategoryEnabled(parsed.kind)) {
      return { status: "skipped", reason: `Memory category disabled: ${parsed.kind}` };
    }
    const now = new Date().toISOString();
    const id = createId();
    const mem0 = await this.options.adapter.add({
      text: sanitized.text,
      metadata: {
        memoryId: id,
        kind: parsed.kind,
        sourceRefs: parsed.sourceRefs,
      },
    });
    const record: MemoryRecord = {
      ...parsed,
      semanticText: sanitized.text,
      body: parsed.summary,
      id,
      profileId: this.options.profileId ?? "default",
      mem0Id: mem0.id,
      status: parsed.retentionClass === "archived" ? "archived" : "active",
      capturePolicy: "auto_default",
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(id, record);
    this.log({
      memoryId: id, eventType: "captured", actor: options.actor,
      runId: options.runId, auditRef: options.auditRef, payload: { sourceRefs: parsed.sourceRefs },
    });
    return { status: "captured", record };
  }

  get(id: string): MemoryRecord | undefined {
    const record = this.records.get(id);
    return record ? { ...record, tags: [...record.tags], sourceRefs: [...record.sourceRefs] } : undefined;
  }

  list(): MemoryRecord[] {
    return [...this.records.values()]
      .filter((record) => record.status !== "deleted")
      .map((record) => ({ ...record }));
  }

  importRecords(records: MemoryRecord[]): void {
    for (const record of records) {
      if (record.profileId !== (this.options.profileId ?? "default")) continue;
      this.records.set(record.id, { ...record, tags: [...record.tags], sourceRefs: [...record.sourceRefs] });
    }
  }

  update(
    id: string,
    patch: Partial<Pick<MemoryRecord, "summary" | "semanticText" | "tags" | "retentionClass" | "body">>,
    actor = "user",
  ): MemoryRecord {
    const record = this.requireRecord(id);
    if (patch.body !== undefined) {
      patch.summary = patch.body;
      patch.semanticText = patch.body;
    }
    Object.assign(record, patch, { updatedAt: new Date().toISOString() });
    if (record.mem0Id && patch.semanticText) {
      void this.options.adapter.update({
        id: record.mem0Id,
        text: patch.semanticText,
        metadata: {
          memoryId: id,
          kind: record.kind,
          sourceRefs: record.sourceRefs,
        },
      });
    }
    this.log({ memoryId: id, eventType: patch.retentionClass === "pinned" ? "pinned" : "updated", actor, payload: { patch } });
    return { ...record };
  }

  archive(id: string, reason = "archived", actor = "user"): MemoryRecord {
    const record = this.requireRecord(id);
    record.status = "archived";
    record.retentionClass = "archived";
    record.updatedAt = new Date().toISOString();
    this.log({ memoryId: id, eventType: "archived", actor, payload: { reason } });
    return { ...record };
  }

  async forget(id: string, actor = "user"): Promise<MemoryRecord> {
    const record = this.requireRecord(id);
    if (record.mem0Id) {
      await this.options.adapter.delete(record.mem0Id);
    }
    record.status = "deleted";
    record.deletedAt = new Date().toISOString();
    record.updatedAt = record.deletedAt;
    this.log({ memoryId: id, eventType: "deleted", actor, payload: {} });
    return { ...record };
  }

  setCategoryEnabled(kind: MemoryKind, enabled: boolean, actor = "user"): void {
    this.categoryToggles.setCategoryEnabled(kind, enabled);
    this.log({ eventType: enabled ? "category_enabled" : "category_disabled", actor, payload: { kind } });
  }

  categoryEnabled(kind: MemoryKind): boolean {
    return this.categoryToggles.isCategoryEnabled(kind);
  }

  markRecalled(id: string, actor: string, relevance: number): void {
    const record = this.requireRecord(id);
    record.lastRecalledAt = new Date().toISOString();
    record.updatedAt = record.lastRecalledAt;
    this.log({ memoryId: id, eventType: "recalled", actor, payload: { relevance } });
  }

  async searchMem0(query: string, limit: number): Promise<Mem0SearchResult[]> {
    return this.options.adapter.search({ query, limit });
  }

  recall(query: string): MemoryRecord[] {
    const terms = tokenize(query);
    return [...this.records.values()]
      .filter((record) => record.status === "active" && this.categoryToggles.isCategoryEnabled(record.kind))
      .filter((record) => relevance(record.semanticText, terms) > 0)
      .sort((a, b) => Number(b.retentionClass === "pinned") - Number(a.retentionClass === "pinned"))
      .map((record) => ({ ...record }));
  }

  findByMem0Id(mem0Id: string): MemoryRecord | undefined {
    return [...this.records.values()].find((record) => record.mem0Id === mem0Id);
  }

  private requireRecord(id: string): MemoryRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Memory not found: ${id}`);
    return record;
  }

  private log(input: Omit<MemoryActivity, "id" | "createdAt">): void {
    this.activity.push({
      ...input,
      id: createId(),
      createdAt: new Date().toISOString(),
    });
  }
}
