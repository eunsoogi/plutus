import { expect, test } from "@playwright/test";

test("office route owns the desktop surface without clipping menu controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/office?runtime=local&locale=ko");

  await expect(
    page.getByRole("heading", { name: "오케스트레이터 오피스" }),
  ).toBeVisible();
  await expect(page.getByTestId("orchestrator-office-scene")).toBeVisible();
  await expect(page.getByTestId("orchestrator-office-canvas")).toHaveAttribute(
    "data-office-model-source",
    "kenney-furniture-kit",
  );

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const office = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office']",
    );
    const scene = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office-scene']",
    );
    const controls = document.querySelector<HTMLElement>(
      ".orchestrator-office__controls",
    );
    const roster = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office-roster']",
    );
    const signals = document.querySelector<HTMLElement>(
      ".orchestrator-office__signals",
    );

    if (
      mainSurface === null ||
      office === null ||
      scene === null ||
      controls === null ||
      roster === null ||
      signals === null
    ) {
      throw new Error("Office route metrics were unavailable");
    }

    const mainRect = mainSurface.getBoundingClientRect();
    const officeRect = office.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    const rosterRect = roster.getBoundingClientRect();
    const signalsRect = signals.getBoundingClientRect();
    const mainStyle = window.getComputedStyle(mainSurface);
    const availableWidth =
      mainRect.width -
      Number.parseFloat(mainStyle.paddingLeft) -
      Number.parseFloat(mainStyle.paddingRight);
    const availableHeight =
      mainRect.height -
      Number.parseFloat(mainStyle.paddingTop) -
      Number.parseFloat(mainStyle.paddingBottom);

    return {
      bodyOverflows:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      mainSurfaceOverflows:
        mainSurface.scrollHeight > mainSurface.clientHeight + 1,
      officeHeightFill: officeRect.height / availableHeight,
      officeWidthFill: officeRect.width / availableWidth,
      sceneHeight: sceneRect.height,
      controlsBottom: controlsRect.bottom,
      rosterBottom: rosterRect.bottom,
      signalsBottom: signalsRect.bottom,
      viewportHeight: window.innerHeight,
    };
  });

  expect(metrics.bodyOverflows).toBe(false);
  expect(metrics.mainSurfaceOverflows).toBe(false);
  expect(metrics.officeWidthFill).toBeGreaterThanOrEqual(0.96);
  expect(metrics.officeHeightFill).toBeGreaterThanOrEqual(0.9);
  expect(metrics.sceneHeight).toBeGreaterThanOrEqual(520);
  expect(metrics.controlsBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.rosterBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.signalsBottom).toBeLessThanOrEqual(metrics.viewportHeight);
});

test("office route stays usable at short desktop height without clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/office?runtime=local&locale=ko");

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
      throw new Error("Short office route metrics were unavailable");
    }

    const officeRect = office.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();

    return {
      mainSurfaceOverflows:
        mainSurface.scrollHeight > mainSurface.clientHeight + 1,
      officeBottom: officeRect.bottom,
      sceneHeight: sceneRect.height,
      viewportHeight: window.innerHeight,
    };
  });

  expect(metrics.mainSurfaceOverflows).toBe(false);
  expect(metrics.officeBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.sceneHeight).toBeGreaterThanOrEqual(320);
});

test("office route shows visible agent nameplates for each person in the scene", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/office?runtime=local&locale=ko");

  const nameplates = page.getByTestId("orchestrator-office-agent-nameplate");
  await expect(nameplates).toHaveCount(5);
  await expect(nameplates).toContainText([
    "리서치 오케스트레이터",
    "시장 데이터 리서처",
    "포트폴리오 매니저",
    "리스크 매니저",
    "보고서 작성자",
  ]);
});

test("office route keeps the Kenney model visible on mobile without page scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/office?runtime=local&locale=ko");

  await expect(page.getByTestId("orchestrator-office-scene")).toBeVisible();
  await expect(page.getByTestId("orchestrator-office-canvas")).toHaveAttribute(
    "data-office-model-source",
    "kenney-furniture-kit",
  );

  const metrics = await page.evaluate(() => {
    const office = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office']",
    );
    const scene = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office-scene']",
    );
    const controls = document.querySelector<HTMLElement>(
      ".orchestrator-office__controls",
    );

    if (office === null || scene === null || controls === null) {
      throw new Error("Mobile office route metrics were unavailable");
    }

    const sceneRect = scene.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();

    return {
      bodyOverflows:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      controlsBottom: controlsRect.bottom,
      sceneMinHeight: window.getComputedStyle(scene).minHeight,
      sceneHeight: sceneRect.height,
      viewportHeight: window.innerHeight,
    };
  });

  expect(metrics.bodyOverflows).toBe(false);
  expect(metrics.controlsBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.sceneMinHeight).toBe("360px");
  expect(metrics.sceneHeight).toBeGreaterThanOrEqual(300);
});
