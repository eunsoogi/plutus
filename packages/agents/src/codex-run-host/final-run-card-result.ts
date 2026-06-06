import type { CodexRunRequest, CodexRunResult } from "./codex-run-host";
import { finalRunCardSchema } from "./schemas";

export function finalRunResultFor(
  request: CodexRunRequest,
  events: CodexRunResult["events"],
  finalRunCard: unknown,
): CodexRunResult {
  const parsed = finalRunCardSchema.safeParse(
    finalRunCard && typeof finalRunCard === "object"
      ? {
          ...(finalRunCard as Record<string, unknown>),
          runId: request.runId,
          profileId: request.profileId,
        }
      : finalRunCard,
  );
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
  if (!request.allowedRecommendationCategories.includes(parsed.data.category)) {
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
    finalRunCard: { ...parsed.data },
    validationFailures: [],
  };
}
