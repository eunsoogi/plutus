import { expect, test } from "@playwright/test";
test("command-backed remote editors preserve and save notes", async ({
  page,
}) => {
  const callsKey = `plutusRemoteEditCalls-${Date.now()}`;
  await page.addInitScript((key) => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      const calls = JSON.parse(localStorage.getItem(key) ?? "[]");
      calls.push(envelope);
      localStorage.setItem(key, JSON.stringify(calls));
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
                  quantity: 2,
                  averageCost: 175,
                  thesis: "Existing thesis",
                },
              ],
            },
          ],
          watchlists: [
            {
              id: "watchlist-real",
              name: "Real Watchlist",
              items: [
                {
                  id: "watch-real",
                  symbol: "MSFT",
                  triggerNote: "Existing note",
                },
              ],
            },
          ],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [
            {
              name: "Test iPhone",
            },
          ],
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
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  }, callsKey);

  await page.goto("/remote/portfolios/portfolio-real?remote=connected");
  await expect(page.getByLabel("AAPL thesis note")).toHaveValue(
    "Existing thesis",
  );
  await page.getByRole("button", { name: "Save thesis to Mac" }).click();
  await expect(page.getByTestId("remote-edit-status")).toContainText(
    "Saved thesis to Mac",
  );

  await page.goto("/remote/watchlists/watchlist-real?remote=connected");
  await expect(page.getByLabel("MSFT watchlist note")).toHaveValue(
    "Existing note",
  );
  await page
    .getByRole("button", { name: "Save watchlist note to Mac" })
    .click();
  await expect(page.getByTestId("remote-watchlist-status")).toContainText(
    "Saved watchlist note to Mac",
  );

  const calls = await page.evaluate((key) => {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
      command: string;
      args: unknown[];
    }>;
  }, callsKey);
  expect(calls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        command: "remote.prepareUnlock",
        args: [
          expect.objectContaining({
            commandType: "portfolio.updatePositionThesis",
            payload: expect.objectContaining({
              positionId: "position-real",
            }),
          }),
        ],
      }),
      expect.objectContaining({
        command: "remote.executeCommand",
        args: [
          expect.objectContaining({
            commandType: "portfolio.updatePositionThesis",
          }),
        ],
      }),
      expect.objectContaining({
        command: "remote.prepareUnlock",
        args: [
          expect.objectContaining({
            commandType: "watchlist.updateItem",
            payload: expect.objectContaining({
              itemId: "watch-real",
            }),
          }),
        ],
      }),
      expect.objectContaining({
        command: "remote.executeCommand",
        args: [
          expect.objectContaining({
            commandType: "watchlist.updateItem",
          }),
        ],
      }),
    ]),
  );
});

test("command-backed remote editors do not fall back to the first entity for bad route ids", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-real",
          portfolios: [
            {
              id: "portfolio-real",
              name: "Real Portfolio",
              positions: [
                {
                  id: "position-real",
                  symbol: "AAPL",
                  quantity: 2,
                  averageCost: 175,
                  thesis: "Existing thesis",
                },
              ],
            },
          ],
          watchlists: [
            {
              id: "watchlist-real",
              name: "Real Watchlist",
              items: [
                {
                  id: "watch-real",
                  symbol: "MSFT",
                  triggerNote: "Existing note",
                },
              ],
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
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });

  await page.goto("/remote/portfolios/not-real?remote=connected");
  await expect(page.getByLabel("Position thesis note")).toBeDisabled();
  await expect(page.getByLabel("AAPL thesis note")).toHaveCount(0);

  await page.goto("/remote/watchlists/not-real?remote=connected");
  await expect(page.getByLabel("Watchlist item note")).toBeDisabled();
  await expect(page.getByLabel("MSFT watchlist note")).toHaveCount(0);
});
