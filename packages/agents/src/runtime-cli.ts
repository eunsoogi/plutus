import { CodexSdkRunHost } from "./codex-run-host/codex-sdk-run-host";
import { modelFinalRunCardSchema } from "./codex-run-host/schemas";

const host = new CodexSdkRunHost({
  env: process.env,
  workingDirectory: process.env.PLUTUS_WORKSPACE_PATH,
});

const handle = await host.startResearchRun({
  runId: process.env.PLUTUS_RUN_ID || undefined,
  profileId: required("PLUTUS_PROFILE_ID"),
  portfolioId: process.env.PLUTUS_PORTFOLIO_ID || undefined,
  selectedTeam: process.env.PLUTUS_SELECTED_TEAM || undefined,
  userRequest: required("PLUTUS_USER_REQUEST"),
  appDataPath: process.env.PLUTUS_APP_DATA_PATH || undefined,
});

process.stdout.write(`${JSON.stringify({ type: "started", ...handle })}\n`);

let finalOutput: unknown;
for await (const event of host.streamResearchRun(handle)) {
  process.stdout.write(`${JSON.stringify({ type: "event", event })}\n`);
  if (
    event &&
    typeof event === "object" &&
    "finalOutput" in event &&
    (event as { finalOutput?: unknown }).finalOutput
  ) {
    finalOutput = (event as { finalOutput?: unknown }).finalOutput;
  }
}
finalOutput ??= await host.requestStructuredTurn(handle, {
  prompt:
    "Return the final Plutus run card as strict JSON with title, userRequest, selectedTeam, category, riskValidation, summary, confidence, warnings, evidenceRefs, supportingEvidence, freshness, caveats, assumptions, dissentingViews, riskChecklist, artifacts, artifactRefs, limitations, nextActions, and approvalRequired.",
  schema: modelFinalRunCardSchema,
});

process.stdout.write(
  `${JSON.stringify({ type: "finalOutput", finalOutput })}\n`,
);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
