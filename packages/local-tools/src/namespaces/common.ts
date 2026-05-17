import type { LocalToolCall, LocalToolRunContext } from "../context";
import type { InMemoryToolRuntime } from "../audit/in-memory-audit";
import { createHash } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
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

export const contentHash = (content: string): string =>
  `sha256:${createHash("sha256").update(content).digest("hex")}`;

export function storagePath(
  runtime: InMemoryToolRuntime,
  context: LocalToolRunContext,
  ...segments: string[]
): string {
  const root =
    runtime.storageRoot ??
    context.appDataPath ??
    join(process.cwd(), ".plutus-local-tools");
  return join(root, ...segments);
}

export function writeDurableJson(
  runtime: InMemoryToolRuntime,
  context: LocalToolRunContext,
  segments: string[],
  value: unknown,
): string {
  const path = storagePath(runtime, context, ...segments);
  mkdirSync(dirname(path), { recursive: true });
  atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

export function writeDurableText(
  runtime: InMemoryToolRuntime,
  context: LocalToolRunContext,
  segments: string[],
  content: string,
): string {
  const path = storagePath(runtime, context, ...segments);
  mkdirSync(dirname(path), { recursive: true });
  atomicWrite(path, content);
  return path;
}

function atomicWrite(path: string, content: string) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content, "utf8");
  const fd = openSync(tmp, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
}
