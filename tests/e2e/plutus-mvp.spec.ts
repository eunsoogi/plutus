import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __PLUTUS_COMMAND_BRIDGE__?: (envelope: {
      command: string;
      args: unknown[];
    }) => Promise<unknown>;
  }
}

test("browser runtime starts empty instead of seeded with BTC/NVDA data", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local");
  await expect(
    page.getByRole("heading", { name: "Plutus Research Desk" }),
  ).toBeVisible();
  await expect(page.getByTestId("portfolio-core")).toContainText(
    "No portfolio yet",
  );
  await expect(page.getByText("BTC/NVDA")).toHaveCount(0);

  await page.getByRole("link", { name: "Watchlists" }).click();
  await expect(page.getByTestId("watchlist-default")).toContainText(
    "No watchlist yet",
  );

  await page.getByRole("link", { name: "Runs" }).click();
  await expect(
    page.getByRole("button", { name: "Start Research Run" }),
  ).toBeDisabled();
  await expect(page.getByTestId("final-run-card")).toContainText("none");
});

test("desktop run detail renders empty local state without generated artifacts", async ({
  page,
}) => {
  await page.goto("/runs/run-btc-nvda?runtime=local");
  await expect(
    page.getByRole("heading", { name: "No research runs yet" }),
  ).toBeVisible();
  await expect(page.getByTestId("artifact-list")).toContainText("Artifacts");
  await expect(
    page.getByRole("link", { name: /Open BTC NVDA risk report/ }),
  ).toHaveCount(0);
});

test("command-backed runtime renders real non-fixture portfolio data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
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
                  id: "position-aapl",
                  symbol: "AAPL",
                  name: "Apple Inc.",
                  quantity: 2,
                  averageCost: 175,
                  thesis: "Actual user-entered position",
                },
              ],
            },
          ],
          watchlists: [
            {
              id: "watchlist-real",
              name: "Real Watchlist",
              items: [{ id: "watch-msft", symbol: "MSFT" }],
            },
          ],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    };
  });
  await page.goto("/dashboard");
  await expect(page.getByTestId("portfolio-core")).toContainText(
    "Real Portfolio",
  );
  await expect(page.getByTestId("portfolio-core")).toContainText("AAPL");
  await expect(page.getByText("BTC/NVDA")).toHaveCount(0);
  await page.getByRole("link", { name: "Watchlists" }).click();
  await expect(page.getByTestId("watchlist-default")).toContainText(
    "Real Watchlist",
  );
});

test("mobile remote routes show connected, disconnected, stale, and revoked command states", async ({
  page,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    "mobile remote states are asserted on the phone project",
  );

  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-mobile",
          portfolios: [
            {
              id: "portfolio-mobile",
              name: "Mobile Portfolio",
              baseCurrency: "USD",
              positions: [
                {
                  id: "position-msft",
                  symbol: "MSFT",
                  name: "Microsoft",
                  quantity: 1,
                  averageCost: 400,
                  thesis: "Remote controlled portfolio",
                },
              ],
            },
          ],
          watchlists: [],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [
            {
              name: "Mobile",
            },
          ],
        };
      }
      if (envelope.command === "remote.prepareUnlock") {
        return {
          sessionId: "session-mobile",
          sessionKeyRef: "secure://session-mobile",
          unlockProof: {
            method: "biometric",
            sessionKeyRef: "secure://session-mobile",
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
          data: {
            id: "run-mobile",
            status: "queued",
            portfolioId: "portfolio-mobile",
            selectedTeam: "portfolio_review_committee",
          },
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    };
  });

  await page.goto("/remote/dashboard?remote=connected");
  await expect(page.getByTestId("remote-state")).toContainText(
    "Connected to Plutus Mac",
  );
  await expect(
    page.getByRole("button", { name: "Start Remote Research Run" }),
  ).toBeEnabled();

  await page.goto("/remote/dashboard?remote=disconnected");
  await expect(page.getByTestId("remote-state")).toContainText("Disconnected");
  await expect(
    page.getByRole("button", { name: "Start Remote Research Run" }),
  ).toBeDisabled();

  await page.goto("/remote/dashboard?remote=stale");
  await expect(page.getByTestId("remote-state")).toContainText(
    "Stale snapshot",
  );
  await expect(
    page.getByRole("button", { name: "Start Remote Research Run" }),
  ).toBeDisabled();

  await page.goto("/remote/dashboard?remote=revoked");
  await expect(page.getByTestId("remote-state")).toContainText("Revoked");
  await expect(page.getByTestId("remote-command-error")).toContainText(
    "permission revoked",
  );
});
