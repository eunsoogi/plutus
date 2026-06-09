import { expect, test } from "@playwright/test";
import { syncUpbitHoldings } from "./acceptance-helpers";

test("MVP acceptance scenario queues host run and exposes mobile preview", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local");
  await page.evaluate(() => localStorage.removeItem("plutus.localRuntime.v1"));
  await syncUpbitHoldings(page);

  await page.goto("/runs?runtime=local");
  await expect(
    page.getByRole("heading", { name: "Research Runs", level: 1 }),
  ).toBeVisible();
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
