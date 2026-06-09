import { expect, test } from "@playwright/test";
import "./plutus-mvp-helpers";

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
