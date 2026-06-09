import { expect, test } from "@playwright/test";

test("host dashboard presents the office as the default full-screen surface", async ({
  page,
}) => {
  // Given: the default desktop host dashboard is loaded.
  await page.setViewportSize({ width: 1440, height: 960 });

  // When: the dashboard renders the local office before a run starts.
  await page.goto("/dashboard?runtime=local&locale=ko");
  await expect(page.getByTestId("orchestrator-office-scene")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const office = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office']",
    );
    const scene = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office-scene']",
    );

    if (mainSurface === null || office === null || scene === null) {
      throw new Error("Office full-screen layout metrics were unavailable");
    }

    const mainRect = mainSurface.getBoundingClientRect();
    const officeRect = office.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const mainStyle = window.getComputedStyle(mainSurface);
    const availableWidth =
      mainRect.width -
      Number.parseFloat(mainStyle.paddingLeft) -
      Number.parseFloat(mainStyle.paddingRight);
    const availableBandHeight =
      mainRect.bottom -
      officeRect.top -
      Number.parseFloat(mainStyle.paddingBottom);

    return {
      bodyOverflows:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      officeBandFill: officeRect.height / availableBandHeight,
      officeWidthFill: officeRect.width / availableWidth,
      sceneBandFill: sceneRect.height / availableBandHeight,
    };
  });

  // Then: the office is the primary viewport surface, not a nested card.
  expect(metrics.bodyOverflows).toBe(false);
  expect(metrics.officeWidthFill).toBeGreaterThanOrEqual(0.96);
  expect(metrics.officeBandFill).toBeGreaterThanOrEqual(0.92);
  expect(metrics.sceneBandFill).toBeGreaterThanOrEqual(0.64);
});

test("host dashboard keeps the full-screen office usable at short desktop height", async ({
  page,
}) => {
  // Given: a shorter desktop host dashboard viewport is loaded.
  await page.setViewportSize({ width: 1280, height: 720 });

  // When: the office renders inside the constrained desktop shell.
  await page.goto("/dashboard?runtime=local&locale=ko");
  await expect(page.getByTestId("orchestrator-office-scene")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const office = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office']",
    );
    const scene = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office-scene']",
    );

    if (mainSurface === null || office === null || scene === null) {
      throw new Error("Short-height office metrics were unavailable");
    }

    const mainRect = mainSurface.getBoundingClientRect();
    const officeRect = office.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const mainStyle = window.getComputedStyle(mainSurface);
    const availableBandHeight =
      mainRect.bottom -
      officeRect.top -
      Number.parseFloat(mainStyle.paddingBottom);

    return {
      bodyOverflows:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      mainSurfaceOverflows:
        mainSurface.scrollHeight > mainSurface.clientHeight + 1,
      officeBandFill: officeRect.height / availableBandHeight,
      sceneHeight: sceneRect.height,
    };
  });

  // Then: the office fills the available band without moving scroll to the body.
  expect(metrics.bodyOverflows).toBe(false);
  expect(metrics.mainSurfaceOverflows).toBe(false);
  expect(metrics.officeBandFill).toBeGreaterThanOrEqual(0.9);
  expect(metrics.sceneHeight).toBeGreaterThanOrEqual(300);
});
