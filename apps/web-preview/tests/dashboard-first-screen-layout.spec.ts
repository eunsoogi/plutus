import { expect, test } from "@playwright/test";

test("host dashboard fits the first screen at 1440x960 without clipping the Korean workflow pill", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  await expect(page.getByRole("heading", { name: "호스트 대시보드" })).toBeVisible();
  await expect(page.getByText("포트폴리오 검토")).toBeVisible();
  await expect(page.getByTestId("orchestrator-office-scene")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const header = document.querySelector<HTMLElement>(".page-header");
    const office = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office']",
    );
    const scene = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office-scene']",
    );
    const workflowPill = Array.from(
      document.querySelectorAll<HTMLElement>(".page-header .pill"),
    ).find((element) => element.textContent?.includes("포트폴리오 검토"));

    const toRect = (element: HTMLElement | null) =>
      element === null
        ? null
        : {
            top: element.getBoundingClientRect().top,
            bottom: element.getBoundingClientRect().bottom,
            height: element.getBoundingClientRect().height,
          };

    const sceneRect = toRect(scene);
    const visibleSceneHeight =
      sceneRect === null
        ? 0
        : Math.max(
            0,
            Math.min(sceneRect.bottom, window.innerHeight) -
              Math.max(sceneRect.top, 0),
          );

    return {
      bodyOverflows:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      mainSurfaceOverflows:
        mainSurface === null
          ? true
          : mainSurface.scrollHeight > mainSurface.clientHeight + 1,
      headerRect: toRect(header),
      workflowPillRect: toRect(workflowPill ?? null),
      officeRect: toRect(office),
      visibleSceneHeight,
      viewportHeight: window.innerHeight,
    };
  });

  expect(metrics.bodyOverflows).toBe(false);
  expect(metrics.mainSurfaceOverflows).toBe(false);
  expect(metrics.headerRect).not.toBeNull();
  expect(metrics.workflowPillRect).not.toBeNull();
  expect(metrics.officeRect).not.toBeNull();
  expect(metrics.visibleSceneHeight).toBeGreaterThanOrEqual(180);

  if (
    metrics.headerRect === null ||
    metrics.workflowPillRect === null ||
    metrics.officeRect === null
  ) {
    throw new Error("Dashboard layout metrics were unavailable");
  }

  expect(metrics.workflowPillRect.top).toBeGreaterThanOrEqual(
    metrics.headerRect.top + 12,
  );
  expect(metrics.workflowPillRect.bottom).toBeLessThanOrEqual(
    metrics.headerRect.bottom - 12,
  );
  expect(metrics.officeRect.top).toBeLessThan(metrics.viewportHeight - 120);
});
