import {
  LocalToolRouter,
  type LocalToolResponse,
  type LocalToolRunContext,
  type ToolCall,
} from "@plutus/local-tools";
export { parseMcpToolName } from "./namespace-registry";
export { decodeSignedRunContext } from "./run-context";
export { createStdioMcpAdapter } from "./stdio-server";
export type { StdioMcpAdapter, StdioMcpAdapterOptions } from "./stdio-server";

export class LocalMcpAdapter {
  constructor(private readonly router = new LocalToolRouter()) {}

  async handle(request: {
    runContext?: LocalToolRunContext;
    call: ToolCall;
  }): Promise<LocalToolResponse> {
    if (!request.runContext) {
      return {
        ok: false,
        sourceRefs: [],
        warnings: [
          {
            code: "missing_run_context",
            severity: "blocking",
            message:
              "MCP adapter requires a signed run context from the Mac host.",
            evidenceRefs: [],
          },
        ],
        auditRef: "audit-missing-context",
      };
    }
    return this.router.call(request.runContext, request.call);
  }

  listNamespaces(context: LocalToolRunContext) {
    return context.allowedNamespaces;
  }
}

export const hasNetworkListener = false;
