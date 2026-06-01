import { expect, test } from "@playwright/test";

test("mobile run detail cancels through the remote command bridge", async ({
  page,
}) => {
  const callsKey = `plutusRemoteCancelCalls-${Date.now()}`;
  await page.addInitScript((key) => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      const calls = JSON.parse(localStorage.getItem(key) ?? "[]");
      calls.push(envelope);
      localStorage.setItem(key, JSON.stringify(calls));
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-real",
          portfolios: [],
          watchlists: [],
          runs: [
            {
              id: "run-real",
              title: "Remote risk review",
              status: "running",
              category: "portfolio",
            },
          ],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [{ name: "Test iPhone" }],
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
          data: { cancelled: true },
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  }, callsKey);

  await page.goto("/remote/runs/run-real?remote=connected");
  await expect(
    page.getByRole("heading", { name: "Remote Run Detail" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cancel Mac-hosted run" }).click();
  await expect(page.getByTestId("remote-run-cancel-status")).toContainText(
    "Command bridge",
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
            commandType: "run.cancel",
            payload: { runId: "run-real" },
          }),
        ],
      }),
      expect.objectContaining({
        command: "remote.executeCommand",
        args: [
          expect.objectContaining({
            commandType: "run.cancel",
            payload: { runId: "run-real" },
          }),
        ],
      }),
    ]),
  );
});
