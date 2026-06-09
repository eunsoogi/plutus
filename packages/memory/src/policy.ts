import type { MemoryKind } from "./schema";

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
