import { expect, test } from "@playwright/test";
test("browser runtime does not render seeded portfolio data without a command bridge", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("runtime-unavailable")).toContainText(
    "No local Plutus runtime bridge is connected",
  );
  await expect(page.getByText("BTC/NVDA Risk Review")).toHaveCount(0);
  await expect(page.getByText("Core Portfolio")).toHaveCount(0);
});

test("locale query renders Korean chrome and persists language changes", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local&locale=ko");
  await expect(page.getByRole("link", { name: "포트폴리오" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "호스트 대시보드" }),
  ).toBeVisible();
  await expect(page.getByLabel("언어")).toHaveValue("ko");

  await page.getByLabel("언어").selectOption("en");
  await expect(page).toHaveURL(/locale=en/);
  await expect(page.getByRole("link", { name: "Portfolios" })).toBeVisible();

  await page.goto("/remote/dashboard?remote=connected&locale=ko");
  await expect(page.getByLabel("언어")).toHaveValue("ko");
  await expect(page.getByTestId("remote-state")).toContainText(
    "Plutus Mac에 연결됨",
  );
});

test("Korean locale covers host and remote UI chrome without English leftovers", async ({
  page,
}) => {
  const koreanRoutes = [
    "/dashboard?runtime=local&locale=ko",
    "/portfolios?runtime=local&locale=ko",
    "/watchlists/watchlist-default?runtime=local&locale=ko",
    "/runs?runtime=local&locale=ko",
    "/settings/providers?runtime=local&locale=ko",
    "/memory?runtime=local&locale=ko",
    "/wiki/wiki-btc-nvda-concentration?runtime=local&locale=ko",
    "/settings/remote-control?runtime=local&locale=ko",
    "/remote/dashboard?remote=connected&locale=ko",
    "/remote/portfolios/portfolio-core?remote=connected&locale=ko",
    "/remote/watchlists/watchlist-default?remote=connected&locale=ko",
    "/remote/runs/run-btc-nvda?remote=connected&locale=ko",
    "/remote/settings?remote=connected&locale=ko",
  ] as const;
  const untranslatedChrome = [
    "Current guardrail",
    "Run Progress",
    "Artifacts",
    "No artifacts yet",
    "No portfolio yet",
    "No watchlist yet",
    "No research runs yet",
    "No memory captured yet",
    "No wiki pages captured yet",
    "Create Portfolio",
    "Position Thesis Notes",
    "Watchlist Notes",
    "Editable Notes",
    "Memory Activity",
    "Activity Feed",
    "Category Toggles",
    "Archive memory",
    "Forget memory",
    "Wiki Browser",
    "Wiki Page",
    "Revision Timeline",
    "Source Links",
    "Diff View",
    "Not Found",
    "Remote Control",
    "Status",
    "Enabled",
    "Pairing code",
    "Connected device",
    "Pair With Mac",
    "Connection",
    "Remote Portfolio",
    "Remote Thesis Edit",
    "Save thesis to Mac",
    "Remote Watchlist",
    "Remote Note Edit",
    "Save watchlist note to Mac",
    "Remote Run Detail",
    "Cancel Mac-hosted run",
    "Remote Settings",
    "Provider Settings",
    "Read-only",
    "Biometric unlock required",
    "MVP",
    "Portfolio review",
    "Awaiting local data",
    "Local data loaded",
    "Primary Portfolio",
    "Agent activity",
    "Workspace status",
  ];

  for (const route of koreanRoutes) {
    await page.goto(route);
    const visibleText = await page.locator("body").innerText();
    for (const englishText of untranslatedChrome) {
      expect(
        visibleText,
        `${route} still contains ${englishText}`,
      ).not.toContain(englishText);
    }
  }

  await page.goto("/dashboard?runtime=local&locale=ko");
  await expect(
    page.getByRole("heading", { name: "아직 포트폴리오 없음" }),
  ).toBeVisible();
  await expect(page.getByText("아직 포트폴리오 없음 포트폴리오")).toHaveCount(
    0,
  );

  await page.goto("/settings/remote-control?runtime=local&locale=ko");
  await expect(page.getByText("페어링 안 됨").first()).toBeVisible();
  await expect(
    page.getByText("기기를 페어링한 뒤 연결을 해제할 수 있습니다"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /연결 해제/ })).toHaveCount(0);

  await page.goto("/dashboard?runtime=local&locale=ko");
  await expect(page.getByRole("link", { name: "거래 연동" })).toBeVisible();
  await expect(page.getByText("거래 Provider")).toHaveCount(0);
  await page.getByRole("link", { name: "거래 연동" }).click();
  await expect(
    page.getByRole("heading", { name: "거래 연동 설정" }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("provider-kiwoom")).toContainText("키움증권");
  await page.getByTestId("provider-search").fill("업비트");
  await expect(page.getByTestId("provider-upbit")).toContainText("업비트");
  await page.getByTestId("provider-search").fill("코인베이스");
  await expect(page.getByTestId("provider-coinbase")).toContainText(
    "코인베이스",
  );
  await page.getByTestId("provider-search").fill("바이낸스");
  await expect(page.getByTestId("provider-binance")).toContainText("바이낸스");
  await page.getByTestId("provider-search").fill("");
  await expect(page.getByTestId("provider-health-summary")).toContainText(
    "설정 안 됨112",
  );
  await expect(page.getByTestId("provider-health-summary")).not.toContainText(
    "연결됨3",
  );
});

test("mobile remote routes show connected, disconnected, and revoked states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/remote/dashboard");
  await expect(page.getByTestId("connection-state")).toHaveText(
    "Connected to Plutus Mac",
  );
  await page.goto("/connection?state=disconnected");
  await expect(page.getByTestId("connection-state")).toHaveText("Disconnected");
  await page.goto("/remote/dashboard?state=revoked");
  await expect(page.getByTestId("connection-state")).toHaveText("Revoked");
  await expect(page.getByTestId("remote-command")).toBeDisabled();
});
