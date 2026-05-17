import type { NamespaceHandler } from "./common";
import { ok, warning } from "./common";

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/i,
  /hide (all )?risk/i,
  /reveal (secrets|credentials|private keys)/i,
  /change (tool )?permissions/i,
];

export function detectPromptInjection(value: unknown): boolean {
  const text = JSON.stringify(value ?? "");
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export const handleResearch: NamespaceHandler = ({ call, auditRef }) => {
  const warnings = detectPromptInjection(call.input)
    ? [
        warning(
          "prompt_injection_detected",
          "warning",
          "Untrusted source text attempted to override instructions, permissions, secrets, or risk disclosure.",
        ),
      ]
    : [];

  return ok(
    auditRef,
    "plutus_research",
    {
      promptInjectionWarning: warnings.length > 0,
      summary: "Source summary preserved with provenance.",
      sourceRefs: (call.input as { sourceRefs?: unknown[] })?.sourceRefs ?? [],
    },
    warnings,
  );
};
