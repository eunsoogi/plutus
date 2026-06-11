import { expect, test } from "@playwright/test";
import { syncUpbitHoldings } from "./ui-helpers";

test("ready run placeholder with only an id does not render started progress", async ({
  page,
}) => {
  // Given: the runtime has reserved a run id but has not started real work.
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-placeholder",
          portfolios: [
            {
              id: "portfolio-placeholder",
              name: "Placeholder Portfolio",
              baseCurrency: "USD",
              positions: [],
            },
          ],
          watchlists: [],
          runs: [
            {
              id: "run-placeholder",
              portfolioId: "portfolio-placeholder",
              status: "ready",
              title: "Pending placeholder",
              category: "",
            },
          ],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });

  // When: the Runs page renders the placeholder snapshot.
  await page.goto("/runs?runtime=local");

  // Then: the unstarted stage list remains visible instead of run status chrome.
  await expect(page.getByTestId("run-progress")).toContainText("planning");
  await expect(page.getByTestId("run-progress")).not.toContainText("ready");
  await expect(page.getByTestId("command-source")).toHaveCount(0);
});

test("command bridge run source persists after returning to Runs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const runStartedKey = "plutus.commandBridgeRunStarted";
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      const runStarted = localStorage.getItem(runStartedKey) === "1";
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-bridge",
          portfolios: [
            {
              id: "portfolio-bridge",
              name: "Bridge Portfolio",
              baseCurrency: "USD",
              positions: [
                {
                  id: "position-bridge",
                  symbol: "AAPL",
                  name: "Apple Inc.",
                  quantity: 1,
                  averageCost: 100,
                  thesis: "Bridge position",
                },
              ],
            },
          ],
          watchlists: [],
          runs: [
            {
              id: "run-bridge",
              portfolioId: "portfolio-bridge",
              status: runStarted ? "completed" : "ready",
              title: "Bridge run",
              category: runStarted ? "portfolio_review" : "",
              finalCard: runStarted
                ? {
                    selectedTeam: "portfolio_review_committee",
                    summary: "Bridge run complete",
                  }
                : undefined,
            },
          ],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
        };
      }
      if (envelope.command === "researchRuns.start") {
        localStorage.setItem(runStartedKey, "1");
        return {
          id: "run-bridge",
          portfolioId: "portfolio-bridge",
          status: "queued",
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });

  await page.goto("/runs?runtime=local");
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("command-source")).toHaveText("Command bridge");

  await page.goto("/dashboard?runtime=local");
  await page.goto("/runs?runtime=local");

  await expect(page.getByTestId("run-progress")).toContainText("completed");
  await expect(page.getByTestId("command-source")).toHaveText("Command bridge");
});

test("browser local runtime queues a research run only after real portfolio state exists", async ({
  page,
}) => {
  await page.goto("/runs?runtime=local");
  await page.evaluate(() => localStorage.removeItem("plutus.localRuntime.v1"));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start Research Run" }),
  ).toBeDisabled();
  await expect(page.getByTestId("final-run-card")).toContainText("none");
  await expect(page.getByTestId("orchestrator-office")).toHaveCount(0);
  await expect(page.getByText(/BTC|NVDA/)).toHaveCount(0);

  await syncUpbitHoldings(page);
  await page.goto("/runs?runtime=local");
  await expect(
    page.getByRole("button", { name: "Start Research Run" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");
});

test("office route renders the orchestrator office before a research run starts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("plutus.localRuntime.v1");
  });

  await page.goto("/office?runtime=local");

  await expect(page.getByTestId("orchestrator-office-stage")).toContainText(
    "Planning",
  );
  await expect(page.getByTestId("orchestrator-office")).toBeVisible();
  await expect(page.getByTestId("orchestrator-office-scene")).toBeVisible();
});

test("browser local runtime restores queued run state after returning to Runs", async ({
  page,
}) => {
  // Given: a persisted local-browser research run exists.
  await page.goto("/runs?runtime=local");
  await page.evaluate(() => localStorage.removeItem("plutus.localRuntime.v1"));
  await syncUpbitHoldings(page);
  await page.goto("/runs?runtime=local");
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");

  // When: the Runs page remounts after route navigation.
  await page.goto("/dashboard?runtime=local");
  await page.goto("/runs?runtime=local");

  // Then: the visible run state comes from the latest scenario snapshot.
  await expect(page.getByTestId("run-progress")).toContainText("queued");
  await expect(page.getByTestId("command-source")).toHaveText("Local runtime");
});
