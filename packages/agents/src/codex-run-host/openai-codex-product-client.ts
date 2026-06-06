import { Codex, type Thread, type ThreadEvent } from "@openai/codex-sdk";
import { z } from "zod";
import type {
  CodexRunRequest,
  ResearchRunHandle,
  StartResearchRunInput,
} from "./codex-run-host";
import { makeRunId } from "./product-run-config";
import { zodToJsonSchemaShape } from "./zod-json-schema";

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
  initialPrompt: string;
  mcpServers: Record<
    string,
    { command: string; args: string[]; env: Record<string, string> }
  >;
  teamAgents: string[];
  rootSandboxMode: "read-only" | "workspace-write";
}

export class OpenAiCodexSdkProductClient implements CodexSdkClient {
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
    const streamed = await thread.runStreamed(request.initialPrompt);
    const threadId = await captureThreadId(streamed.events);
    this.threadsById.set(threadId, thread);
    this.streamsByThreadId.set(
      threadId,
      mapThreadEvents(streamed.events, request.profileId),
    );
    return { runId: request.runId ?? makeRunId(request), threadId };
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
      yield eventForItem(event, profileId);
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

function eventForItem(
  event: Extract<ThreadEvent, { type: "item.started" | "item.completed" }>,
  profileId: string,
) {
  const item = event.item;
  if (item.type === "mcp_tool_call") {
    return {
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
    return {
      stage: "reporting",
      type: "agent.message",
      message: item.text,
      payload: { profileId },
    };
  }
  return {
    stage: "executing",
    type: event.type,
    message: item.type,
    payload: item,
  };
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
