import { expect, test } from "@playwright/test";

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
