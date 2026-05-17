import { createHash, createHmac, randomBytes } from "node:crypto";
import { Codex, type Thread, type ThreadEvent } from "@openai/codex-sdk";
import { z } from "zod";
import {
  AGENT_ALLOWLISTS,
  type LocalToolRunContext,
} from "@plutus/local-tools";
import type {
  CodexRunHost,
  CodexRunRequest,
  CodexRunResult,
  ProductCodexRunHost,
  ResearchRunHandle,
  ResumeResearchRunOptions,
  StartResearchRunInput,
  StructuredTurnRequest,
} from "./codex-run-host";
import { codexRunEventSchema, finalRunCardSchema } from "./schemas";

export interface CodexSdkClient {
  runStreamed(request: CodexRunRequest): AsyncIterable<unknown>;
  startResearchRun?(request: ProductStartResearchRunRequest): Promise<{
    runId: string;
    threadId: string;
  }>;
  streamResearchRun?(handle: ResearchRunHandle): AsyncIterable<unknown>;
  resumeResearchRun?(request: {
    threadId: string;
    configHash: string;
    profileId?: string;
    runId?: string;
  }): Promise<{ runId: string; threadId: string }>;
  requestStructuredTurn?<T>(request: {
    threadId: string;
    prompt: string;
    schema: z.ZodType<T>;
  }): Promise<unknown>;
  cancelResearchRun?(request: { threadId: string }): Promise<void>;
  archiveResearchRun?(request: { threadId: string }): Promise<void>;
}

export interface CodexSdkRunHostOptions {
  client?: CodexSdkClient;
  env?: Record<string, string | undefined>;
  workingDirectory?: string;
}

export interface ProductStartResearchRunRequest extends StartResearchRunInput {
  configHash: string;
  mcpServers: Record<
    string,
    { command: string; args: string[]; env: Record<string, string> }
  >;
  teamAgents: string[];
  rootSandboxMode: "read-only" | "workspace-write";
}

const teamAgents: Record<string, string[]> = {
  portfolio_review_committee: [
    "market_data_researcher",
    "portfolio_manager",
    "risk_manager",
    "report_writer",
  ],
  investment_committee: [
    "equity_analyst",
    "technical_analyst",
    "portfolio_manager",
    "risk_manager",
    "report_writer",
  ],
  crypto_research_desk: [
    "crypto_analyst",
    "technical_analyst",
    "quant_strategy_researcher",
    "risk_manager",
    "report_writer",
  ],
  quant_strategy_desk: [
    "market_data_researcher",
    "quant_strategy_researcher",
    "risk_manager",
    "report_writer",
  ],
  technical_analysis_panel: [
    "market_data_researcher",
    "technical_analyst",
    "risk_manager",
    "report_writer",
  ],
  strategy_exploration_panel: [
    "quant_strategy_researcher",
    "portfolio_manager",
    "risk_manager",
    "report_writer",
  ],
  knowledge_curation_desk: ["llm_wiki_curator", "report_writer"],
};

const teamNamespaces: Record<string, string[]> = {
  portfolio_review_committee: [
    "plutus_portfolio",
    "plutus_market_data",
    "plutus_risk",
    "plutus_memory",
    "plutus_reports",
    "plutus_audit",
  ],
  investment_committee: [
    "plutus_market_data",
    "plutus_research",
    "plutus_portfolio",
    "plutus_risk",
    "plutus_memory",
    "plutus_reports",
    "plutus_audit",
  ],
  crypto_research_desk: [
    "plutus_market_data",
    "plutus_research",
    "plutus_backtest",
    "plutus_risk",
    "plutus_reports",
    "plutus_audit",
  ],
  quant_strategy_desk: [
    "plutus_market_data",
    "plutus_backtest",
    "plutus_risk",
    "plutus_reports",
    "plutus_audit",
    "plutus_memory",
  ],
  technical_analysis_panel: [
    "plutus_market_data",
    "plutus_risk",
    "plutus_reports",
    "plutus_audit",
  ],
  strategy_exploration_panel: [
    "plutus_portfolio",
    "plutus_market_data",
    "plutus_backtest",
    "plutus_risk",
    "plutus_reports",
    "plutus_research",
    "plutus_audit",
  ],
  knowledge_curation_desk: [
    "plutus_memory",
    "plutus_wiki",
    "plutus_reports",
    "plutus_research",
    "plutus_audit",
  ],
};

const teamWritableNamespaces: Record<string, string[]> = {
  portfolio_review_committee: [
    "plutus_risk",
    "plutus_reports",
    "plutus_memory",
    "plutus_audit",
  ],
  investment_committee: [
    "plutus_risk",
    "plutus_reports",
    "plutus_memory",
    "plutus_audit",
  ],
  crypto_research_desk: [
    "plutus_backtest",
    "plutus_risk",
    "plutus_reports",
    "plutus_audit",
  ],
  quant_strategy_desk: [
    "plutus_backtest",
    "plutus_risk",
    "plutus_reports",
    "plutus_audit",
  ],
  technical_analysis_panel: ["plutus_risk", "plutus_reports", "plutus_audit"],
  strategy_exploration_panel: [
    "plutus_backtest",
    "plutus_risk",
    "plutus_reports",
    "plutus_audit",
  ],
  knowledge_curation_desk: [
    "plutus_memory",
    "plutus_wiki",
    "plutus_reports",
    "plutus_audit",
  ],
};

export class CodexSdkRunHost implements CodexRunHost, ProductCodexRunHost {
  private readonly client?: CodexSdkClient;
  private readonly env?: Record<string, string | undefined>;
  private readonly handlesByThreadId = new Map<string, ResearchRunHandle>();

  constructor(options: CodexSdkRunHostOptions = {}) {
    this.client = options.client ?? new OpenAiCodexSdkProductClient(options);
    this.env = options.env;
  }

  async run(request: CodexRunRequest): Promise<CodexRunResult> {
    const env =
      this.env ??
      (
        globalThis as unknown as {
          process?: { env?: Record<string, string | undefined> };
        }
      ).process?.env;
    if (env?.PLUTUS_RUN_REAL_CODEX_SMOKE !== "1") {
      throw new Error(
        "Real Codex SDK smoke tests are gated behind PLUTUS_RUN_REAL_CODEX_SMOKE=1.",
      );
    }
    if (!this.client) {
      throw new Error("CodexSdkRunHost requires an injected Codex SDK client.");
    }

    const events = [];
    let finalRunCard: unknown;
    for await (const item of this.client.runStreamed(request)) {
      const event = codexRunEventSchema.safeParse(item);
      if (event.success) {
        events.push(event.data);
        continue;
      }
      if (item && typeof item === "object" && "finalRunCard" in item) {
        finalRunCard = (item as { finalRunCard: unknown }).finalRunCard;
      }
    }

    const parsed = finalRunCardSchema.safeParse(finalRunCard);
    if (!parsed.success) {
      return {
        status: "failed",
        events,
        validationFailures: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
    }
    if (
      !request.allowedRecommendationCategories.includes(parsed.data.category)
    ) {
      return {
        status: "failed",
        events,
        validationFailures: [
          {
            path: "category",
            message: `Category ${parsed.data.category} is outside the requested safety envelope.`,
          },
        ],
      };
    }
    if (
      parsed.data.riskValidation === "vetoed" &&
      !["risk_warning", "no_action"].includes(parsed.data.category)
    ) {
      return {
        status: "failed",
        events,
        validationFailures: [
          {
            path: "riskValidation",
            message:
              "Risk-vetoed runs must resolve to risk_warning or no_action.",
          },
        ],
      };
    }
    return {
      status: "completed",
      events,
      finalRunCard: {
        ...parsed.data,
        runId: request.runId,
        profileId: request.profileId,
      },
      validationFailures: [],
    };
  }

  async startResearchRun(
    input: StartResearchRunInput,
  ): Promise<ResearchRunHandle> {
    this.requireSmokeGate();
    const startResearchRun = this.requireProductClient("startResearchRun");
    const configHash = makeConfigHash(input);
    const mcpServers = buildProductMcpServers(input);
    const started = await startResearchRun({
      ...input,
      configHash,
      selectedTeam: resolveSelectedTeam(input),
      mcpServers,
      teamAgents: teamAgents[resolveSelectedTeam(input)],
      rootSandboxMode: rootSandboxModeForTeam(resolveSelectedTeam(input)),
    });
    const handle = { ...started, configHash };
    this.handlesByThreadId.set(handle.threadId, handle);
    return handle;
  }

  async *streamResearchRun(
    handle: ResearchRunHandle,
  ): AsyncIterable<import("./schemas").CodexRunEvent> {
    this.assertKnownHandle(handle);
    const streamResearchRun = this.requireProductClient("streamResearchRun");
    for await (const item of streamResearchRun(handle)) {
      yield codexRunEventSchema.parse(normalizeEvent(item, handle.runId));
    }
  }

  async resumeResearchRun(
    threadId: string,
    options: ResumeResearchRunOptions = {},
  ): Promise<ResearchRunHandle> {
    this.requireSmokeGate();
    const existing = this.handlesByThreadId.get(threadId);
    if (!existing && !options.expectedConfigHash) {
      throw new Error(
        "Cannot resume Codex thread without a known Plutus run config hash.",
      );
    }
    const configHash = existing?.configHash ?? options.expectedConfigHash!;
    if (
      options.expectedConfigHash &&
      existing &&
      options.expectedConfigHash !== existing.configHash
    ) {
      throw new Error("Cannot resume Codex thread: config hash mismatch.");
    }
    const resumeResearchRun = this.requireProductClient("resumeResearchRun");
    const resumed = await resumeResearchRun({
      threadId,
      configHash,
      profileId: options.profileId,
      runId: options.runId,
    });
    const handle = {
      runId: options.runId ?? resumed.runId,
      threadId: resumed.threadId,
      configHash,
    };
    this.handlesByThreadId.set(threadId, handle);
    return handle;
  }

  async requestStructuredTurn<T>(
    handle: ResearchRunHandle,
    request: StructuredTurnRequest<T>,
  ): Promise<T> {
    this.assertKnownHandle(handle);
    const requestStructuredTurn = this.requireProductClient(
      "requestStructuredTurn",
    );
    const response = await requestStructuredTurn({
      threadId: handle.threadId,
      prompt: request.prompt,
      schema: request.schema,
    });
    return request.schema.parse(response);
  }

  async cancelResearchRun(handle: ResearchRunHandle): Promise<void> {
    this.assertKnownHandle(handle);
    const cancelResearchRun = this.requireProductClient("cancelResearchRun");
    await cancelResearchRun({ threadId: handle.threadId });
  }

  async archiveResearchRun(handle: ResearchRunHandle): Promise<void> {
    this.assertKnownHandle(handle);
    const archiveResearchRun = this.requireProductClient("archiveResearchRun");
    await archiveResearchRun({ threadId: handle.threadId });
  }

  private requireSmokeGate() {
    const env =
      this.env ??
      (
        globalThis as unknown as {
          process?: { env?: Record<string, string | undefined> };
        }
      ).process?.env;
    if (env?.PLUTUS_RUN_REAL_CODEX_SMOKE !== "1") {
      throw new Error(
        "Real Codex SDK smoke tests are gated behind PLUTUS_RUN_REAL_CODEX_SMOKE=1.",
      );
    }
  }

  private requireProductClient<K extends keyof Required<CodexSdkClient>>(
    method: K,
  ): Required<CodexSdkClient>[K] {
    if (!this.client || typeof this.client[method] !== "function") {
      throw new Error(
        `CodexSdkRunHost requires an injected Codex SDK client with ${String(method)}.`,
      );
    }
    return this.client[method].bind(this.client) as Required<CodexSdkClient>[K];
  }

  private assertKnownHandle(handle: ResearchRunHandle) {
    const existing = this.handlesByThreadId.get(handle.threadId);
    if (!existing || existing.configHash !== handle.configHash) {
      throw new Error("Unknown or stale Codex run handle.");
    }
  }
}

function makeConfigHash(input: StartResearchRunInput) {
  const selectedTeam = resolveSelectedTeam(input);
  return createHash("sha256")
    .update(
      JSON.stringify({
        profileId: input.profileId,
        portfolioId: input.portfolioId ?? null,
        selectedTeam,
        userRequest: input.userRequest,
        appDataPath: input.appDataPath ?? null,
        agents: teamAgents[selectedTeam],
        namespaces: teamNamespaces[selectedTeam],
        writableNamespaces: teamWritableNamespaces[selectedTeam],
      }),
    )
    .digest("hex");
}

function buildProductMcpServers(input: StartResearchRunInput) {
  const selectedTeam = resolveSelectedTeam(input);
  const namespaces = teamNamespaces[selectedTeam];
  const writableNamespaces = new Set(teamWritableNamespaces[selectedTeam]);
  const runContextSecret = randomBytes(32).toString("hex");

  const entries = [];
  for (const agentName of teamAgents[selectedTeam]) {
    const allowlist = AGENT_ALLOWLISTS[agentName];
    for (const namespace of [...namespaces].sort()) {
      if (!allowlist.allowedNamespaces.includes(namespace)) continue;
      const serverName = `${agentName}__${namespace}`;
      const context: LocalToolRunContext = {
        runId: makeRunId({
          configHash: createHash("sha256")
            .update(`${selectedTeam}:${input.profileId}:${input.userRequest}`)
            .digest("hex"),
        }),
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
        serverName,
        {
          command: "pnpm",
          args: [
            "--filter",
            "@plutus/local-mcp-adapter",
            "start",
            namespace,
            ...(!writableNamespaces.has(namespace) ? ["--read-only"] : []),
            "--stdio",
          ],
          env: {
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

function resolveSelectedTeam(input: StartResearchRunInput) {
  const selectedTeam = input.selectedTeam ?? "portfolio_review_committee";
  if (!teamAgents[selectedTeam]) {
    throw new Error(`Unknown Plutus team preset: ${selectedTeam}.`);
  }
  return selectedTeam;
}

function rootSandboxModeForTeam(selectedTeam: string) {
  return teamWritableNamespaces[selectedTeam].length > 0
    ? ("workspace-write" as const)
    : ("read-only" as const);
}

function normalizeEvent(item: unknown, runId: string) {
  if (!item || typeof item !== "object") {
    return item;
  }
  return {
    runId,
    at: new Date(0).toISOString(),
    ...item,
  };
}

class OpenAiCodexSdkProductClient implements CodexSdkClient {
  private readonly env?: Record<string, string>;
  private readonly workingDirectory?: string;
  private readonly threadsById = new Map<string, Thread>();
  private readonly streamsByThreadId = new Map<
    string,
    AsyncIterable<unknown>
  >();

  constructor(options: CodexSdkRunHostOptions) {
    this.env = normalizeEnv(options.env);
    this.workingDirectory = options.workingDirectory;
  }

  runStreamed(_request: CodexRunRequest): AsyncIterable<unknown> {
    throw new Error(
      "Legacy runStreamed requires an injected Codex SDK client.",
    );
  }

  async startResearchRun(
    request: ProductStartResearchRunRequest,
  ): Promise<{ runId: string; threadId: string }> {
    const codex = new Codex({
      env: this.env,
      config: { mcp_servers: request.mcpServers },
    });
    const thread = codex.startThread({
      workingDirectory: this.workingDirectory,
      sandboxMode: request.rootSandboxMode,
      approvalPolicy: "never",
      networkAccessEnabled: false,
    });
    const streamed = await thread.runStreamed(buildInitialPrompt(request));
    const threadId = await captureThreadId(streamed.events);
    this.threadsById.set(threadId, thread);
    this.streamsByThreadId.set(
      threadId,
      mapThreadEvents(streamed.events, request.profileId),
    );
    return { runId: makeRunId(request), threadId };
  }

  streamResearchRun(handle: ResearchRunHandle): AsyncIterable<unknown> {
    const stream = this.streamsByThreadId.get(handle.threadId);
    if (!stream) {
      throw new Error("No active Codex stream is registered for this thread.");
    }
    return stream;
  }

  async resumeResearchRun(request: {
    threadId: string;
    configHash: string;
    profileId?: string;
    runId?: string;
  }): Promise<{ runId: string; threadId: string }> {
    const codex = new Codex({ env: this.env });
    const thread = codex.resumeThread(request.threadId, {
      workingDirectory: this.workingDirectory,
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccessEnabled: false,
    });
    const streamed = await thread.runStreamed(
      "Resume this Plutus research run from the persisted Codex thread. Continue streaming only the remaining plan-ground-execute-validate-deliver events.",
    );
    this.threadsById.set(request.threadId, thread);
    this.streamsByThreadId.set(
      request.threadId,
      mapThreadEvents(streamed.events, request.profileId ?? request.threadId),
    );
    return {
      runId: request.runId ?? makeRunId(request),
      threadId: request.threadId,
    };
  }

  async requestStructuredTurn<T>(request: {
    threadId: string;
    prompt: string;
    schema: z.ZodType<T>;
  }): Promise<unknown> {
    const thread = this.requireThread(request.threadId);
    const result = await thread.run(request.prompt, {
      outputSchema: zodToJsonSchemaShape(request.schema),
    });
    return JSON.parse(result.finalResponse);
  }

  async cancelResearchRun(_request: { threadId: string }): Promise<void> {}

  async archiveResearchRun(request: { threadId: string }): Promise<void> {
    this.threadsById.delete(request.threadId);
    this.streamsByThreadId.delete(request.threadId);
  }

  private requireThread(threadId: string) {
    const thread = this.threadsById.get(threadId);
    if (!thread) {
      throw new Error(
        "Cannot request a structured turn for an unknown thread.",
      );
    }
    return thread;
  }
}

async function captureThreadId(events: AsyncGenerator<ThreadEvent>) {
  const first = await events.next();
  if (first.done || !first.value || first.value.type !== "thread.started") {
    throw new Error("Codex SDK did not emit thread.started for the run.");
  }
  return first.value.thread_id;
}

async function* mapThreadEvents(
  events: AsyncGenerator<ThreadEvent>,
  profileId: string,
) {
  for await (const event of events) {
    if (event.type === "turn.started") {
      yield {
        stage: "planning",
        type: "run.stage_started",
        message: "Codex turn started.",
      };
    }
    if (event.type === "item.started" || event.type === "item.completed") {
      const item = event.item;
      if (item.type === "mcp_tool_call") {
        yield {
          stage: "executing",
          type:
            event.type === "item.started"
              ? "tool.call_started"
              : "tool.call_completed",
          message: `${item.server}.${item.tool}`,
          payload: item,
        };
      }
      if (item.type === "agent_message") {
        yield {
          stage: "reporting",
          type: "agent.message",
          message: item.text,
          payload: { profileId },
        };
      }
    }
    if (event.type === "turn.completed") {
      yield {
        stage: "completed",
        type: "run.completed",
        message: "Codex turn completed.",
        payload: event.usage,
      };
    }
    if (event.type === "turn.failed" || event.type === "error") {
      yield {
        stage: "failed",
        type: "run.failed",
        message:
          event.type === "turn.failed" ? event.error.message : event.message,
      };
    }
  }
}

function buildInitialPrompt(request: ProductStartResearchRunRequest) {
  return [
    "Start a Plutus research run.",
    `Profile: ${request.profileId}`,
    request.portfolioId ? `Portfolio: ${request.portfolioId}` : undefined,
    `Team: ${resolveSelectedTeam(request)}`,
    `Config hash: ${request.configHash}`,
    `User request: ${request.userRequest}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function makeRunId(input: { configHash: string }) {
  return `run_${input.configHash.slice(0, 16)}`;
}

function normalizeEnv(env?: Record<string, string | undefined>) {
  if (!env) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
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

function zodToJsonSchemaShape(
  schema: z.ZodType<unknown>,
): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    return {
      type: "object",
      additionalProperties: false,
      required: Object.keys(shape),
      properties: Object.fromEntries(
        Object.entries(shape).map(([key, value]) => [
          key,
          zodToJsonSchemaShape(value as z.ZodType<unknown>),
        ]),
      ),
    };
  }
  if (schema instanceof z.ZodLiteral) {
    const value = schema.value;
    return { const: value, type: typeof value };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options };
  }
  if (schema instanceof z.ZodString) {
    return { type: "string" };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: "number" };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchemaShape(schema.element) };
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return zodToJsonSchemaShape(schema.unwrap());
  }
  return {
    type: "object",
    description:
      "Structured Plutus response validated again by the product adapter.",
  };
}
