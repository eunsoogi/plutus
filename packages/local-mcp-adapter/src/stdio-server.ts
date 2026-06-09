import type { Readable, Writable } from "node:stream";
import type { LocalToolResponse, LocalToolRouter } from "@plutus/local-tools";
import {
  LocalToolRouter as DefaultLocalToolRouter,
  WRITE_TOOLS,
} from "@plutus/local-tools";
import { decodeSignedRunContext } from "./run-context";
import { parseMcpToolName } from "./namespace-registry";
import { runJsonRpcLoop } from "./stdio-json-rpc";

export interface StdioMcpAdapterOptions {
  router: LocalToolRouter;
  signedRunContext: string;
  namespace: string;
  readOnly?: boolean;
  runContextSecret?: string;
}

export interface StdioMcpAdapter {
  callTool(name: string, input: unknown): Promise<LocalToolResponse>;
  listTools(): Array<{
    name: string;
    description: string;
    inputSchema: object;
  }>;
}

export interface StartStdioServerOptions {
  input?: Readable;
  output?: Writable;
  router?: LocalToolRouter;
  env?: Record<string, string | undefined>;
}

export interface StdioAdapterStartCommandOptions {
  readOnly?: boolean;
}

export function buildStdioAdapterStartCommand(
  namespace: string,
  options: StdioAdapterStartCommandOptions = {},
) {
  return {
    command: "pnpm",
    args: [
      "--filter",
      "@plutus/local-mcp-adapter",
      "start",
      namespace,
      ...(options.readOnly ? ["--read-only"] : []),
      "--stdio",
    ],
  };
}

export function createStdioMcpAdapter(
  options: StdioMcpAdapterOptions,
): StdioMcpAdapter {
  return {
    listTools() {
      const context = decodeSignedRunContext(options.signedRunContext, {
        namespace: options.namespace,
        secret: options.runContextSecret,
      });
      if (!context) {
        return [];
      }
      return context.allowedTools
        .filter((toolName) => toolName.startsWith(`${options.namespace}.`))
        .filter((toolName) => !options.readOnly || !WRITE_TOOLS.has(toolName))
        .map((toolName) => ({
          name: toolName,
          description: `Plutus local MCP tool ${toolName}`,
          inputSchema: { type: "object", additionalProperties: true },
        }));
    },
    async callTool(name, input) {
      const context = decodeSignedRunContext(options.signedRunContext, {
        namespace: options.namespace,
        secret: options.runContextSecret,
      });
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

      if (parsed.namespace !== options.namespace) {
        return adapterFailure(
          "namespace_not_bound",
          `MCP server ${options.namespace} cannot call namespace ${parsed.namespace}.`,
        );
      }

      if (options.readOnly && WRITE_TOOLS.has(name)) {
        return adapterFailure(
          "read_only_violation",
          `MCP server ${options.namespace} is read-only and cannot call ${name}.`,
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

export function parseStartArgs(argv: string[]) {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const namespace = positional[0] === "start" ? positional[1] : positional[0];
  return {
    namespace,
    readOnly: argv.includes("--read-only"),
    stdio: argv.includes("--stdio"),
  };
}

export async function startStdioServer(
  argv = process.argv.slice(2),
  options: StartStdioServerOptions = {},
) {
  const parsed = parseStartArgs(argv);
  if (!parsed.namespace) {
    throw new Error(
      "Usage: local-mcp-adapter start <namespace> [--read-only] --stdio",
    );
  }
  if (!parsed.stdio) {
    throw new Error("Only stdio transport is supported for local MCP adapter.");
  }

  const env = options.env ?? process.env;
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const adapter = createStdioMcpAdapter({
    router: options.router ?? new DefaultLocalToolRouter(),
    namespace: parsed.namespace,
    readOnly: parsed.readOnly,
    runContextSecret: env.PLUTUS_RUN_CONTEXT_SECRET,
    signedRunContext: env.PLUTUS_SIGNED_RUN_CONTEXT ?? "",
  });

  await runJsonRpcLoop(input, output, adapter);
}

if (process.argv[1]?.endsWith("stdio-server.ts")) {
  startStdioServer().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

function adapterFailure(code: string, message: string): LocalToolResponse {
  return {
    ok: false,
    sourceRefs: [],
    warnings: [{ code, severity: "blocking", message, evidenceRefs: [] }],
    auditRef: "audit_adapter_rejected",
  };
}
