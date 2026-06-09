import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { StdioMcpAdapter } from "./stdio-server";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

export async function runJsonRpcLoop(
  input: Readable,
  output: Writable,
  adapter: StdioMcpAdapter,
) {
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    await handleJsonRpcLine(line, output, adapter);
  }
  if (output !== process.stdout) {
    output.end();
  }
}

async function handleJsonRpcLine(
  line: string,
  output: Writable,
  adapter: StdioMcpAdapter,
) {
  let request: JsonRpcRequest;
  try {
    request = JSON.parse(line) as JsonRpcRequest;
  } catch {
    writeJson(output, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    return;
  }

  if (!("id" in request)) {
    return;
  }

  try {
    await respondToJsonRpcRequest(request, output, adapter);
  } catch {
    writeJson(output, {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32603, message: "Internal error" },
    });
  }
}

async function respondToJsonRpcRequest(
  request: JsonRpcRequest,
  output: Writable,
  adapter: StdioMcpAdapter,
) {
  if (request.method === "initialize") {
    writeJson(output, {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "@plutus/local-mcp-adapter",
          version: "0.1.0",
        },
      },
    });
    return;
  }

  if (request.method === "tools/list") {
    writeJson(output, {
      jsonrpc: "2.0",
      id: request.id,
      result: { tools: adapter.listTools() },
    });
    return;
  }

  if (request.method === "tools/call") {
    await respondToToolCall(request, output, adapter);
    return;
  }

  writeJson(output, {
    jsonrpc: "2.0",
    id: request.id,
    error: { code: -32601, message: "Method not found" },
  });
}

async function respondToToolCall(
  request: JsonRpcRequest,
  output: Writable,
  adapter: StdioMcpAdapter,
) {
  const params = request.params as
    | { name?: unknown; arguments?: unknown }
    | undefined;
  if (!params || typeof params.name !== "string") {
    writeJson(output, {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32602, message: "Invalid params" },
    });
    return;
  }
  const result = await adapter.callTool(params.name, params.arguments);
  writeJson(output, {
    jsonrpc: "2.0",
    id: request.id,
    result: {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.ok,
    },
  });
}

function writeJson(output: Writable, value: unknown) {
  output.write(`${JSON.stringify(value)}\n`);
}
