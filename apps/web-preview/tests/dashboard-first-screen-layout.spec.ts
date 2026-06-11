import { expect, test } from "@playwright/test";

test("host dashboard fits the first screen without embedding the office view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  await expect(
    page.getByRole("heading", { name: "호스트 대시보드" }),
  ).toBeVisible();
  await expect(page.getByText("포트폴리오 검토")).toBeVisible();
  await expect(page.getByTestId("orchestrator-office")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오피스" })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const header = document.querySelector<HTMLElement>(".page-header");
    const dashboardGrid =
      document.querySelector<HTMLElement>(".dashboard-grid");
    const workflowPill = Array.from(
      document.querySelectorAll<HTMLElement>(".page-header .pill"),
    ).find((element) => element.textContent?.includes("포트폴리오 검토"));
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".dashboard-grid > *"),
    );

    const toRect = (element: HTMLElement | null) =>
      element === null
        ? null
        : {
            top: element.getBoundingClientRect().top,
            bottom: element.getBoundingClientRect().bottom,
            height: element.getBoundingClientRect().height,
          };

    return {
      bodyOverflows:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      dashboardOverflowY:
        dashboardGrid === null
          ? "missing"
          : window.getComputedStyle(dashboardGrid).overflowY,
      mainSurfaceOverflows:
        mainSurface === null
          ? true
          : mainSurface.scrollHeight > mainSurface.clientHeight + 1,
      headerRect: toRect(header),
      workflowPillRect: toRect(workflowPill ?? null),
      clippedCardCount: cards.filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.bottom > window.innerHeight || rect.right > window.innerWidth;
      }).length,
    };
  });

  expect(metrics.bodyOverflows).toBe(false);
  expect(metrics.mainSurfaceOverflows).toBe(false);
  expect(metrics.dashboardOverflowY).not.toMatch(/auto|scroll/);
  expect(metrics.headerRect).not.toBeNull();
  expect(metrics.workflowPillRect).not.toBeNull();
  expect(metrics.clippedCardCount).toBe(0);

  if (metrics.headerRect === null || metrics.workflowPillRect === null) {
    throw new Error("Dashboard layout metrics were unavailable");
  }

  expect(metrics.workflowPillRect.top).toBeGreaterThanOrEqual(
    metrics.headerRect.top + 12,
  );
  expect(metrics.workflowPillRect.bottom).toBeLessThanOrEqual(
    metrics.headerRect.bottom - 12,
  );
});

test("host dashboard keeps all menu regions readable without nested scroll boxes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const dashboardGrid =
      document.querySelector<HTMLElement>(".dashboard-grid");
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>(".dashboard-grid > *"),
    );

    if (mainSurface === null || dashboardGrid === null || panels.length === 0) {
      throw new Error("Dashboard menu layout metrics were unavailable");
    }

    const scrollMetrics = panels.map((element) => {
      element.scrollTop = element.scrollHeight;
      return {
        overflowY: window.getComputedStyle(element).overflowY,
        scrollTopAfterWrite: element.scrollTop,
      };
    });

    return {
      dashboardOverflowY: window.getComputedStyle(dashboardGrid).overflowY,
      mainSurfaceOverflows:
        mainSurface.scrollHeight > mainSurface.clientHeight + 1,
      panelCount: panels.length,
      scrollMetrics,
    };
  });

  expect(metrics.panelCount).toBeGreaterThanOrEqual(3);
  expect(metrics.dashboardOverflowY).not.toMatch(/auto|scroll/);
  expect(metrics.mainSurfaceOverflows).toBe(false);
  expect(metrics.scrollMetrics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        overflowY: expect.not.stringMatching(/auto|scroll/),
        scrollTopAfterWrite: 0,
      }),
    ]),
  );
});
