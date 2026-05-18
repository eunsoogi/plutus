import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __PLUTUS_COMMAND_BRIDGE__?: (envelope: {
      command: string;
      args: unknown[];
    }) => Promise<unknown>;
    __plutusCommandCalls: Array<{ command: string; args: unknown[] }>;
  }
}

test("MVP acceptance scenario queues host run and exposes mobile preview", async ({
  page,
}) => {
  await page.goto("/portfolios?runtime=local");
  await page.evaluate(() => localStorage.removeItem("plutus.localRuntime.v1"));
  await page.reload();
  await page.getByRole("button", { name: "Create Portfolio" }).click();
  await expect(page.getByTestId("portfolio-command-status")).toContainText(
    "Created Core Portfolio",
  );

  await page.goto("/runs?runtime=local");
  await expect(
    page.getByRole("heading", { name: "Research Runs", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Research Run" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");
  await page.goto("/remote/dashboard?runtime=local");
  await expect(page.getByText("Mobile Remote Controller")).toBeVisible();
  await expect(page.getByTestId("remote-command")).toContainText(
    "Start Mac-hosted run",
  );
  await page.goto("/remote/dashboard?state=revoked");
  await expect(page.getByTestId("remote-command")).toBeDisabled();
});

test("MVP command bridge backs host start, artifact fetch, and remote start", async ({
  page,
}) => {
  const callsKey = `plutusCommandCalls-${Date.now()}`;
  await page.addInitScript((key) => {
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
      const calls = JSON.parse(localStorage.getItem(key) ?? "[]");
      calls.push(envelope);
      localStorage.setItem(key, JSON.stringify(calls));
      const runStarted = localStorage.getItem(`${key}:runStarted`) === "1";
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-real",
          portfolios: [
            {
              id: "portfolio-real",
              name: "Real Portfolio",
              baseCurrency: "USD",
              positions: [
                {
                  id: "position-real",
                  symbol: "AAPL",
                  name: "Apple Inc.",
                  quantity: 3,
                  averageCost: 100,
                  thesis: "Real persisted position",
                },
              ],
            },
          ],
          watchlists: [],
          runs: [
            {
              id: "run-real",
              portfolioId: "portfolio-real",
              status: runStarted ? "completed" : "ready",
              title: "Real portfolio review",
              category: runStarted ? "risk_warning" : "",
              finalCard: runStarted
                ? {
                    recommendationCategory: "risk_warning",
                    title: "Real portfolio review",
                    userRequest: "Review real persisted portfolio",
                    selectedTeam: "portfolio_review_committee",
                    summary: "Real command bridge summary",
                    confidence: "medium",
                    warnings: ["Read-only review"],
                    supportingEvidence: [
                      { label: "Real portfolio", sourceRef: "portfolio-real" },
                    ],
                    riskChecklist: [
                      { check: "No live trading", status: "passed" },
                    ],
                    limitations: ["Preview command bridge"],
                    nextActions: ["Open artifact"],
                  }
                : undefined,
            },
          ],
          artifacts: runStarted
            ? [
                {
                  id: "artifact-real",
                  researchRunId: "run-real",
                  title: "Real artifact",
                  type: "report",
                },
              ]
            : [],
          memoryActivity: runStarted
            ? [
                {
                  id: "memory-activity-real",
                  memoryId: "memory-real",
                  eventType: "memory.captured",
                  payload: { summary: "Real run memory captured" },
                },
              ]
            : [],
          wikiPages: runStarted
            ? [
                {
                  id: "wiki-real",
                  title: "Real run wiki",
                  currentRevisionId: "revision-real",
                  sourceRefs: ["run-real"],
                },
              ]
            : [],
          remoteDevices: [
            {
              name: "Real iPhone",
            },
          ],
        };
      }
      if (envelope.command === "researchRuns.start") {
        localStorage.setItem(`${key}:runStarted`, "1");
        return {
          id: "run-real",
          status: "queued",
          portfolioId: "portfolio-real",
        };
      }
      if (envelope.command === "artifacts.get") {
        return {
          id: "artifact-real",
          title: "Real artifact",
          type: "report",
        };
      }
      if (envelope.command === "remote.prepareUnlock") {
        return {
          sessionId: "session-real",
          sessionKeyRef: "secure://session-real",
          unlockProof: {
            method: "biometric",
            sessionKeyRef: "secure://session-real",
            challenge: "ed25519:test",
          },
        };
      }
      if (envelope.command === "remote.executeCommand") {
        return {
          authorization: {
            success: true,
            permissionGranted: true,
            warnings: [],
          },
          data: { ok: true },
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    };
  }, callsKey);

  await page.goto("/runs?runtime=local");
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");
  await expect(page.getByTestId("command-source")).toHaveText("Command bridge");
  await expect(page.getByText(/Real run memory captured/)).toBeVisible();
  await expect(page.getByText(/Real run wiki/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open Real artifact/ }),
  ).toBeVisible();

  await page.goto("/runs/run-real?runtime=local");
  await expect(page.getByTestId("final-run-card")).toContainText(
    "Real command bridge summary",
  );

  await page.getByRole("link", { name: /Open Real artifact/ }).click();
  await expect(page).toHaveURL(
    /\/runs\/run-real\/artifacts\/artifact-real\?runtime=local$/,
  );
  await expect(page.getByTestId("artifact-command-source")).toHaveText(
    "Command bridge",
  );

  await page.goto("/remote/dashboard?remote=connected");
  await page.getByRole("button", { name: "Start Remote Research Run" }).click();
  await expect(page.getByTestId("remote-command-status")).toHaveText(
    "Command bridge",
  );

  await expect
    .poll(async () =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) ?? "[]").map(
            (call: { command: string }) => call.command,
          ),
        callsKey,
      ),
    )
    .toEqual([
      "app.getSnapshot",
      "researchRuns.start",
      "app.getSnapshot",
      "app.getSnapshot",
      "app.getSnapshot",
      "artifacts.get",
      "app.getSnapshot",
      "remote.prepareUnlock",
      "remote.executeCommand",
    ]);

  const prepareUnlockCall = await page.evaluate((key) => {
    const calls = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
      command: string;
      args: Array<{ commandType?: string; payload?: Record<string, unknown> }>;
    }>;
    return calls.find((call) => call.command === "remote.prepareUnlock");
  }, callsKey);
  expect(prepareUnlockCall?.args[0]).toMatchObject({
    commandType: "run.start",
    payload: {
      portfolioId: "portfolio-real",
      selectedTeam: "portfolio_review_committee",
    },
  });
});
