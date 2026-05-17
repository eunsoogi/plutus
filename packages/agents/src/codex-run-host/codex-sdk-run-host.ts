import type {
  CodexRunHost,
  CodexRunRequest,
  CodexRunResult,
} from "./codex-run-host";
import { codexRunEventSchema, finalRunCardSchema } from "./schemas";

export interface CodexSdkClient {
  runStreamed(request: CodexRunRequest): AsyncIterable<unknown>;
}

export interface CodexSdkRunHostOptions {
  client?: CodexSdkClient;
  env?: Record<string, string | undefined>;
}

export class CodexSdkRunHost implements CodexRunHost {
  private readonly client?: CodexSdkClient;
  private readonly env?: Record<string, string | undefined>;

  constructor(options: CodexSdkRunHostOptions = {}) {
    this.client = options.client;
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
}
