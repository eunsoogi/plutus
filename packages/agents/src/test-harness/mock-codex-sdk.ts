import { z } from "zod";
import type {
  CodexRunHost,
  CodexRunRequest,
  CodexRunResult,
  ValidationFailure,
} from "../codex-run-host/codex-run-host";
import {
  codexRunEventSchema,
  finalRunCardSchema,
} from "../codex-run-host/schemas";
import type { ScriptedRunScenario } from "./scripted-run-stream";
import { eventFor } from "./scripted-run-stream";

export class MockCodexRunHost implements CodexRunHost {
  constructor(private readonly scenario: ScriptedRunScenario) {}

  async run(request: CodexRunRequest): Promise<CodexRunResult> {
    const events = [];
    for (const stage of this.scenario.stages) {
      if (stage === "completed") {
        break;
      }
      events.push(codexRunEventSchema.parse(eventFor(request.runId, stage)));
      if (request.cancelAfterStage === stage) {
        events.push(
          codexRunEventSchema.parse(
            eventFor(request.runId, "cancelled", "cancelled"),
          ),
        );
        return { status: "cancelled", events, validationFailures: [] };
      }
    }

    const parsed = finalRunCardSchema.safeParse(this.scenario.finalRunCard);
    if (!parsed.success) {
      events.push(
        codexRunEventSchema.parse(
          eventFor(request.runId, "failed", "validation_failed"),
        ),
      );
      return {
        status: "failed",
        events,
        validationFailures: toValidationFailures(parsed.error),
      };
    }

    if (
      !request.allowedRecommendationCategories.includes(parsed.data.category)
    ) {
      events.push(
        codexRunEventSchema.parse(
          eventFor(request.runId, "failed", "unsafe_final_category"),
        ),
      );
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

    const finalRunCard = {
      ...parsed.data,
      runId: request.runId,
      profileId: request.profileId,
    };
    events.push(
      codexRunEventSchema.parse(
        eventFor(request.runId, "completed", "completed", finalRunCard),
      ),
    );
    return {
      status: "completed",
      events,
      finalRunCard,
      validationFailures: [],
    };
  }
}

function toValidationFailures(error: z.ZodError): ValidationFailure[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
