import type { LocalToolResponse, LocalToolRouter } from "@plutus/local-tools";
import { decodeSignedRunContext } from "./run-context";
import { parseMcpToolName } from "./namespace-registry";

export interface StdioMcpAdapterOptions {
  router: LocalToolRouter;
  signedRunContext: string;
}

export interface StdioMcpAdapter {
  callTool(name: string, input: unknown): Promise<LocalToolResponse>;
}

export function createStdioMcpAdapter(
  options: StdioMcpAdapterOptions,
): StdioMcpAdapter {
  return {
    async callTool(name, input) {
      const context = decodeSignedRunContext(options.signedRunContext);
      const parsed = parseMcpToolName(name);

      if (!context) {
        return adapterFailure(
          "invalid_run_context",
          "Signed run context could not be decoded or validated.",
        );
      }

      if (!parsed) {
        return adapterFailure(
          "unknown_mcp_tool",
          `MCP tool ${name} is not registered.`,
        );
      }

      return options.router.call(context, {
        namespace: parsed.namespace,
        tool: parsed.tool,
        input,
      });
    },
  };
}

function adapterFailure(code: string, message: string): LocalToolResponse {
  return {
    ok: false,
    sourceRefs: [],
    warnings: [{ code, severity: "blocking", message, evidenceRefs: [] }],
    auditRef: "audit_adapter_rejected",
  };
}
