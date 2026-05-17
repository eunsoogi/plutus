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

test("MVP acceptance scenario completes across host and mobile preview", async ({
  page,
}) => {
  await page.goto("/runs");
  await expect(
    page.getByRole("heading", { name: "BTC/NVDA Risk Review" }),
  ).toBeVisible();
  await expect(page.getByTestId("risk-warning")).toContainText(
    "Inspect concentration",
  );
  await expect(page.getByTestId("run-progress")).toContainText("completed");
  await expect(
    page.getByText(
      "Captured: BTC and NVDA concentration needs periodic review.",
    ),
  ).toBeVisible();
  await expect(page.getByText("source-linked revision history")).toBeVisible();
  await page.goto("/remote/dashboard");
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
  await page.goto("/dashboard?scenario=mvp");
  await page.evaluate(() => localStorage.setItem("plutusCommandCalls", "[]"));
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
      const calls = JSON.parse(
        localStorage.getItem("plutusCommandCalls") ?? "[]",
      );
      calls.push(envelope);
      localStorage.setItem("plutusCommandCalls", JSON.stringify(calls));
      if (envelope.command === "researchRuns.start") {
        return {
          id: "run-btc-nvda",
          status: "Risk review complete",
          portfolioId: "portfolio-core",
        };
      }
      if (envelope.command === "artifacts.get") {
        return {
          id: "artifact-risk-report",
          title: "BTC NVDA risk report",
          type: "report",
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    };
  });

  await page.goto("/runs?scenario=mvp");
  await page.getByRole("button", { name: "Start BTC/NVDA Review" }).click();
  await expect(page.getByTestId("run-progress")).toContainText(
    "Risk review complete",
  );
  await expect(page.getByTestId("command-source")).toHaveText("Command bridge");

  await page.goto(
    "/runs/run-btc-nvda/artifacts/artifact-risk-report?scenario=mvp",
  );
  await expect(page.getByTestId("artifact-command-source")).toHaveText(
    "Command bridge",
  );

  await page.goto("/remote/dashboard?scenario=mvp&remote=connected");
  await page
    .getByRole("button", { name: "Start Remote BTC/NVDA Review" })
    .click();
  await expect(page.getByTestId("remote-command-status")).toHaveText(
    "Command bridge",
  );

  await expect
    .poll(async () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("plutusCommandCalls") ?? "[]").map(
          (call: { command: string }) => call.command,
        ),
      ),
    )
    .toEqual(["researchRuns.start", "artifacts.get", "researchRuns.start"]);
});
