import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  AGENT_ALLOWLISTS,
  type LocalToolRunContext,
} from "@plutus/local-tools";
import type { StartResearchRunInput } from "./codex-run-host";
import {
  resolveSelectedTeam,
  teamAgentsFor,
  teamNamespacesFor,
  teamWritableNamespacesFor,
} from "./team-presets";

export function makeConfigHash(input: StartResearchRunInput) {
  const selectedTeam = resolveSelectedTeam(input);
  return createHash("sha256")
    .update(
      JSON.stringify({
        profileId: input.profileId,
        portfolioId: input.portfolioId ?? null,
        selectedTeam,
        userRequest: input.userRequest,
        appDataPath: input.appDataPath ?? null,
        agents: teamAgentsFor(selectedTeam),
        namespaces: teamNamespacesFor(selectedTeam),
        writableNamespaces: teamWritableNamespacesFor(selectedTeam),
      }),
    )
    .digest("hex");
}

export function buildProductMcpServers(input: StartResearchRunInput) {
  const selectedTeam = resolveSelectedTeam(input);
  const namespaces = teamNamespacesFor(selectedTeam);
  const writableNamespaces = new Set(teamWritableNamespacesFor(selectedTeam));
  const runContextSecret = randomBytes(32).toString("hex");
  const repoRoot = process.env.PLUTUS_REPO_ROOT ?? process.cwd();
  const adapterCommand = runtimeCommand(
    process.env.PLUTUS_LOCAL_MCP_ADAPTER_COMMAND,
    [
      "pnpm",
      "--dir",
      repoRoot,
      "--filter",
      "@plutus/local-mcp-adapter",
      "start",
    ],
  );

  const entries = [];
  for (const agentName of teamAgentsFor(selectedTeam)) {
    const allowlist = AGENT_ALLOWLISTS[agentName];
    for (const namespace of [...namespaces].sort()) {
      if (!allowlist.allowedNamespaces.includes(namespace)) continue;
      const context: LocalToolRunContext = {
        runId: input.runId ?? makeRunId({ configHash: contextHash(input) }),
        profileId: input.profileId,
        agentName,
        selectedTeam,
        allowedNamespaces: allowlist.allowedNamespaces.filter((allowed) =>
          namespaces.includes(allowed),
        ),
        allowedTools: allowlist.allowedTools,
        writeScopes: writableNamespaces.has(namespace)
          ? allowlist.writeTools
          : [],
        appDataPath: input.appDataPath,
      };
      entries.push([
        `${agentName}__${namespace}`,
        {
          command: adapterCommand.command,
          args: [
            ...adapterCommand.args,
            namespace,
            ...(!writableNamespaces.has(namespace) ? ["--read-only"] : []),
            "--stdio",
          ],
          env: {
            PLUTUS_REPO_ROOT: repoRoot,
            PLUTUS_RUN_CONTEXT_SECRET: runContextSecret,
            PLUTUS_SIGNED_RUN_CONTEXT: signRunContext(context, {
              namespace,
              secret: runContextSecret,
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            }),
          },
        },
      ]);
    }
  }
  return Object.fromEntries(entries);
}

export function makeRunId(input: { configHash: string }) {
  return `run_${input.configHash.slice(0, 16)}`;
}

function contextHash(input: StartResearchRunInput) {
  const selectedTeam = resolveSelectedTeam(input);
  return createHash("sha256")
    .update(`${selectedTeam}:${input.profileId}:${input.userRequest}`)
    .digest("hex");
}

function runtimeCommand(
  configured: string | undefined,
  fallback: string[],
): { command: string; args: string[] } {
  const parts =
    configured
      ?.split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean) ?? fallback;
  if (parts.length === 0) {
    throw new Error("Runtime command is empty.");
  }
  const [command, ...args] = parts;
  if (!command) {
    throw new Error("Runtime command is empty.");
  }
  return { command, args };
}

function signRunContext(
  context: LocalToolRunContext,
  options: { namespace: string; secret: string; expiresAt: Date },
) {
  const payload = Buffer.from(
    JSON.stringify({
      context,
      exp: Math.floor(options.expiresAt.getTime() / 1000),
      namespace: options.namespace,
    }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", options.secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}
