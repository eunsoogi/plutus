import { z } from "zod";

export const SourceRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  title: z.string().optional(),
  url: z.string().url().optional(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const MemoryKindSchema = z.enum([
  "user_preference",
  "research_memory",
  "strategy_memory",
  "workflow_memory",
  "wiki_source_memory",
  "wiki_pointer",
]);

export type MemoryKind = z.infer<typeof MemoryKindSchema>;

export const MemoryCandidateSchema = z.object({
  kind: MemoryKindSchema,
  summary: z.string().min(1),
  semanticText: z.string().min(1),
  tags: z.array(z.string()),
  sourceRefs: z.array(SourceRefSchema),
  sensitivityClass: z.enum([
    "normal",
    "portfolio_private",
    "account_private",
    "secret_blocked",
  ]),
  retentionClass: z.enum(["default", "pinned", "temporary", "archived"]),
});

export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;

export interface Mem0AddInput {
  text: string;
  metadata: Record<string, unknown>;
}

export interface Mem0SearchInput {
  query: string;
  limit?: number;
}

export interface Mem0UpdateInput {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface Mem0WriteResult {
  id: string;
}

export interface Mem0SearchResult {
  id: string;
  score: number;
  text: string;
}

export interface Mem0Adapter {
  add(input: Mem0AddInput): Promise<Mem0WriteResult>;
  search(input: Mem0SearchInput): Promise<Mem0SearchResult[]>;
  update(input: Mem0UpdateInput): Promise<Mem0WriteResult>;
  delete(mem0Id: string): Promise<void>;
}

export class FakeMem0Adapter implements Mem0Adapter {
  records: Array<{
    id: string;
    text: string;
    metadata: Record<string, unknown>;
  }> = [];

  async add(input: Mem0AddInput): Promise<Mem0WriteResult> {
    const id = createId();
    this.records.push({ id, text: input.text, metadata: input.metadata });
    return { id };
  }

  async search(input: Mem0SearchInput): Promise<Mem0SearchResult[]> {
    const terms = tokenize(input.query);
    return this.records
      .map((record) => ({
        id: record.id,
        text: record.text,
        score: relevance(record.text, terms),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit ?? 10);
  }

  async update(input: Mem0UpdateInput): Promise<Mem0WriteResult> {
    const found = this.records.find((record) => record.id === input.id);
    if (!found) throw new Error(`Mem0 record not found: ${input.id}`);
    found.text = input.text;
    found.metadata = input.metadata;
    return { id: input.id };
  }

  async delete(mem0Id: string): Promise<void> {
    this.records = this.records.filter((record) => record.id !== mem0Id);
  }
}

export class SensitivityFilter {
  private readonly blockedPatterns = [
    /\b(api[_-]?key|secret|token|private[_-]?key|seed phrase)\b/i,
    /\bsk-[a-z0-9-]{8,}\b/i,
    /unrestricted broker export|raw account history|every trade/i,
    /ignore previous instructions|exfiltrate|prompt injection/i,
  ];

  sanitize(text: string): {
    blocked: boolean;
    text: string;
    warnings: string[];
  } {
    const blocked = this.blockedPatterns.some((pattern) => pattern.test(text));
    return {
      blocked,
      text: blocked ? "" : text.trim(),
      warnings: blocked
        ? ["Sensitive or untrusted text blocked before memory capture."]
        : [],
    };
  }
}

export class CapturePolicy {
  private toggles: Record<MemoryKind, boolean>;

  constructor(toggles: Partial<Record<MemoryKind, boolean>> = {}) {
    this.toggles = {
      user_preference: true,
      research_memory: true,
      strategy_memory: true,
      workflow_memory: true,
      wiki_source_memory: true,
      wiki_pointer: true,
      ...toggles,
    };
  }

  isCategoryEnabled(kind: MemoryKind): boolean {
    return this.toggles[kind];
  }

  setCategoryEnabled(kind: MemoryKind, enabled: boolean): void {
    this.toggles[kind] = enabled;
  }
}

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
  capture(
    candidate: MemoryCandidate,
    options: {
      policy: CapturePolicy;
      actor: string;
      runId?: string;
      auditRef?: string;
    },
  ): Promise<
    | { status: "captured"; record: MemoryRecord }
    | { status: "skipped"; reason: string }
    | { status: "blocked"; reason: string }
  >;
  capture(
    candidateOrSummary: MemoryCandidate | string,
    options?: {
      policy: CapturePolicy;
      actor: string;
      runId?: string;
      auditRef?: string;
    },
  ):
    | MemoryRecord
    | null
    | Promise<
        | { status: "captured"; record: MemoryRecord }
        | { status: "skipped"; reason: string }
        | { status: "blocked"; reason: string }
      > {
    if (typeof candidateOrSummary === "string") {
      const sanitized = this.filter.sanitize(candidateOrSummary);
      if (
        sanitized.blocked ||
        !this.categoryToggles.isCategoryEnabled("research_memory")
      )
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
    return this.captureCandidate(
      candidateOrSummary,
      options ?? { policy: new CapturePolicy(), actor: "system" },
    );
  }

  private async captureCandidate(
    candidate: MemoryCandidate,
    options: {
      policy: CapturePolicy;
      actor: string;
      runId?: string;
      auditRef?: string;
    },
  ): Promise<
    | { status: "captured"; record: MemoryRecord }
    | { status: "skipped"; reason: string }
    | { status: "blocked"; reason: string }
  > {
    const parsed = MemoryCandidateSchema.parse(candidate);
    if (parsed.sensitivityClass === "secret_blocked") {
      return {
        status: "blocked",
        reason: "secret_blocked candidates are never written to Mem0.",
      };
    }
    const sanitized = this.filter.sanitize(parsed.semanticText);
    if (sanitized.blocked) {
      return {
        status: "blocked",
        reason: sanitized.warnings[0] ?? "sensitive text blocked",
      };
    }
    if (
      !options.policy.isCategoryEnabled(parsed.kind) ||
      !this.categoryToggles.isCategoryEnabled(parsed.kind)
    ) {
      return {
        status: "skipped",
        reason: `Memory category disabled: ${parsed.kind}`,
      };
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
      memoryId: id,
      eventType: "captured",
      actor: options.actor,
      runId: options.runId,
      auditRef: options.auditRef,
      payload: { sourceRefs: parsed.sourceRefs },
    });
    return { status: "captured", record };
  }

  get(id: string): MemoryRecord | undefined {
    const record = this.records.get(id);
    return record
      ? {
          ...record,
          tags: [...record.tags],
          sourceRefs: [...record.sourceRefs],
        }
      : undefined;
  }

  list(): MemoryRecord[] {
    return [...this.records.values()]
      .filter((record) => record.status !== "deleted")
      .map((record) => ({ ...record }));
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        MemoryRecord,
        "summary" | "semanticText" | "tags" | "retentionClass" | "body"
      >
    >,
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
    this.log({
      memoryId: id,
      eventType: patch.retentionClass === "pinned" ? "pinned" : "updated",
      actor,
      payload: { patch },
    });
    return { ...record };
  }

  archive(id: string, reason = "archived", actor = "user"): MemoryRecord {
    const record = this.requireRecord(id);
    record.status = "archived";
    record.retentionClass = "archived";
    record.updatedAt = new Date().toISOString();
    this.log({
      memoryId: id,
      eventType: "archived",
      actor,
      payload: { reason },
    });
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
    this.log({
      eventType: enabled ? "category_enabled" : "category_disabled",
      actor,
      payload: { kind },
    });
  }

  categoryEnabled(kind: MemoryKind): boolean {
    return this.categoryToggles.isCategoryEnabled(kind);
  }

  markRecalled(id: string, actor: string, relevance: number): void {
    const record = this.requireRecord(id);
    record.lastRecalledAt = new Date().toISOString();
    record.updatedAt = record.lastRecalledAt;
    this.log({
      memoryId: id,
      eventType: "recalled",
      actor,
      payload: { relevance },
    });
  }

  async searchMem0(query: string, limit: number): Promise<Mem0SearchResult[]> {
    return this.options.adapter.search({ query, limit });
  }

  recall(query: string): MemoryRecord[] {
    const terms = tokenize(query);
    return [...this.records.values()]
      .filter(
        (record) =>
          record.status === "active" &&
          this.categoryToggles.isCategoryEnabled(record.kind),
      )
      .filter((record) => relevance(record.semanticText, terms) > 0)
      .sort(
        (a, b) =>
          Number(b.retentionClass === "pinned") -
          Number(a.retentionClass === "pinned"),
      )
      .map((record) => ({ ...record }));
  }

  findByMem0Id(mem0Id: string): MemoryRecord | undefined {
    return [...this.records.values()].find(
      (record) => record.mem0Id === mem0Id,
    );
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

export interface RecalledMemory {
  memoryId: string;
  summary: string;
  kind: MemoryKind;
  relevance: number;
  sourceRefs: SourceRef[];
  lastRecalledAt?: string;
  warnings: string[];
}

export class RecallService {
  constructor(private readonly store: MemoryStore) {}

  async recall(input: {
    query: string;
    limit?: number;
    actor?: string;
  }): Promise<RecalledMemory[]> {
    const results = await this.store.searchMem0(input.query, input.limit ?? 10);
    const recalled: RecalledMemory[] = [];
    for (const result of results) {
      const record = this.store.findByMem0Id(result.id);
      if (
        !record ||
        record.status !== "active" ||
        !this.store.categoryEnabled(record.kind)
      )
        continue;
      const pinBoost = record.retentionClass === "pinned" ? 0.35 : 0;
      const recencyBoost = record.lastRecalledAt ? 0.02 : 0.05;
      recalled.push({
        memoryId: record.id,
        summary: record.summary,
        kind: record.kind,
        relevance: Math.min(1, result.score + pinBoost + recencyBoost),
        sourceRefs: record.sourceRefs,
        lastRecalledAt: record.lastRecalledAt,
        warnings:
          record.sensitivityClass === "portfolio_private"
            ? ["Portfolio-private memory: compact summary only."]
            : [],
      });
    }
    const sorted = recalled
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, input.limit ?? 10);
    for (const memory of sorted) {
      this.store.markRecalled(
        memory.memoryId,
        input.actor ?? "agent:ground",
        memory.relevance,
      );
    }
    return sorted;
  }
}

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

function inferTags(text: string): string[] {
  const tags = new Set<string>();
  if (/\bbtc|bitcoin\b/i.test(text)) tags.add("btc");
  if (/crossover|moving average/i.test(text)) tags.add("crossover");
  return [...tags];
}

function relevance(text: string, terms: string[]): number {
  const haystack = text.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return terms.length === 0 ? 0 : hits / terms.length;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
}

function createId(): string {
  return crypto.randomUUID();
}
