import { expect, test } from "@playwright/test";

test("dashboard data status reflects loaded local state", async ({ page }) => {
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
              positions: [],
            },
          ],
          watchlists: [],
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

  await page.goto("/dashboard?locale=ko");
  await expect(page.getByText("로컬 데이터 로드됨")).toBeVisible();
  await expect(page.getByText("로컬 데이터 대기 중")).toHaveCount(0);
});

test("empty local wiki does not imply completed wiki activity", async ({
  page,
}) => {
  await page.goto("/wiki?runtime=local");
  await expect(
    page.getByRole("heading", { name: "Wiki Browser" }),
  ).toBeVisible();
  await expect(
    page.getByText("No wiki pages captured yet.").first(),
  ).toBeVisible();
  await expect(
    page.getByText("LLM Wiki Curator updated a source-linked risk lesson."),
  ).toHaveCount(0);
  await expect(page.getByText("audit-wiki-btc-nvda-revision")).toHaveCount(0);
  await expect(page.getByText("stale quote warning")).toHaveCount(0);
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
