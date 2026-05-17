import { CodexSdkRunHost } from "./codex-run-host/codex-sdk-run-host";
import { finalRunCardSchema } from "./codex-run-host/schemas";

const host = new CodexSdkRunHost({
  env: process.env,
  workingDirectory: process.env.PLUTUS_WORKSPACE_PATH,
});

const handle = await host.startResearchRun({
  profileId: required("PLUTUS_PROFILE_ID"),
  portfolioId: process.env.PLUTUS_PORTFOLIO_ID || undefined,
  selectedTeam: process.env.PLUTUS_SELECTED_TEAM || undefined,
  userRequest: required("PLUTUS_USER_REQUEST"),
  appDataPath: process.env.PLUTUS_APP_DATA_PATH || undefined,
});

const events = [];
let finalOutput: unknown;
for await (const event of host.streamResearchRun(handle)) {
  events.push(event);
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
    "Return the final Plutus run card as strict JSON with category, risk validation, summary, warnings, evidence refs, assumptions, dissenting views, artifact refs, and approval requirement.",
  schema: finalRunCardSchema,
});

process.stdout.write(`${JSON.stringify({ ...handle, events, finalOutput })}\n`);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
