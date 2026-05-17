import type { NamespaceHandler } from "./common";
import { ok } from "./common";

export const handleGeneric: NamespaceHandler = ({ call, auditRef }) =>
  ok(auditRef, call.namespace, { tool: call.tool, status: "ok" });
