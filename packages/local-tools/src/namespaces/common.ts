import type { LocalToolCall, LocalToolRunContext } from "../context";
import type { InMemoryToolRuntime } from "../audit/in-memory-audit";
import type {
  LocalToolResponse,
  LocalToolWarning,
  SourceRef,
} from "../schemas/envelope";

export interface NamespaceHandlerArgs {
  context: LocalToolRunContext;
  call: LocalToolCall;
  runtime: InMemoryToolRuntime;
  auditRef: string;
}

export type NamespaceHandler = (
  args: NamespaceHandlerArgs,
) => LocalToolResponse | Promise<LocalToolResponse>;

export const sourceRef = (
  provider: string,
  id = "local-fixture",
): SourceRef => ({
  id,
  provider,
  retrievedAt: new Date(0).toISOString(),
});

export const ok = (
  auditRef: string,
  provider: string,
  data: unknown,
  warnings: LocalToolWarning[] = [],
): LocalToolResponse => ({
  ok: true,
  data,
  sourceRefs: [sourceRef(provider)],
  warnings,
  auditRef,
});

export const warning = (
  code: string,
  severity: LocalToolWarning["severity"],
  message: string,
  evidenceRefs: string[] = [],
): LocalToolWarning => ({ code, severity, message, evidenceRefs });
