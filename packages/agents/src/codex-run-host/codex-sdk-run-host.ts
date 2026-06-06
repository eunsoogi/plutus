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
import { finalRunResultFor } from "./final-run-card-result";
import {
  type CodexSdkClient,
  type CodexSdkRunHostOptions,
  OpenAiCodexSdkProductClient,
} from "./openai-codex-product-client";
import { buildProductMcpServers, makeConfigHash } from "./product-run-config";
import { buildInitialResearchRunPrompt } from "./research-run-prompt";
import { codexRunEventSchema } from "./schemas";
import {
  resolveSelectedTeam,
  rootSandboxModeForTeam,
  teamAgentsFor,
} from "./team-presets";

export type { CodexSdkClient, CodexSdkRunHostOptions };
export type { ProductStartResearchRunRequest } from "./openai-codex-product-client";

export class CodexSdkRunHost implements CodexRunHost, ProductCodexRunHost {
  private readonly client?: CodexSdkClient;
  private readonly env?: Record<string, string | undefined>;
  private readonly handlesByThreadId = new Map<string, ResearchRunHandle>();

  constructor(options: CodexSdkRunHostOptions = {}) {
    this.client = options.client ?? new OpenAiCodexSdkProductClient(options);
    this.env = options.env;
  }

  async run(request: CodexRunRequest): Promise<CodexRunResult> {
    this.requireSmokeGate();
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
    return finalRunResultFor(request, events, finalRunCard);
  }

  async startResearchRun(
    input: StartResearchRunInput,
  ): Promise<ResearchRunHandle> {
    const startResearchRun = this.requireProductClient("startResearchRun");
    const selectedTeam = resolveSelectedTeam(input);
    const configHash = makeConfigHash(input);
    const mcpServers = buildProductMcpServers(input);
    const agents = teamAgentsFor(selectedTeam);
    const started = await startResearchRun({
      ...input,
      configHash,
      selectedTeam,
      initialPrompt: buildInitialResearchRunPrompt({
        ...input,
        selectedTeam,
        configHash,
        teamAgents: agents,
      }),
      mcpServers,
      teamAgents: agents,
      rootSandboxMode: rootSandboxModeForTeam(selectedTeam),
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
    const existing = this.handlesByThreadId.get(threadId);
    const configHash =
      existing?.configHash ??
      requireExpectedConfigHash(options.expectedConfigHash);
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
    const env = this.env ?? process.env;
    if (env.PLUTUS_RUN_REAL_CODEX_SMOKE !== "1") {
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

function normalizeEvent(item: unknown, runId: string) {
  if (!item || typeof item !== "object") {
    return item;
  }
  return {
    at: new Date(0).toISOString(),
    ...item,
    runId,
  };
}

function requireExpectedConfigHash(
  expectedConfigHash: string | undefined,
): string {
  if (!expectedConfigHash) {
    throw new Error(
      "Cannot resume Codex thread without a known Plutus run config hash.",
    );
  }
  return expectedConfigHash;
}
