import { expect, test } from "@playwright/test";

test("host dashboard fits the first screen at 1440x960 without clipping the Korean workflow pill", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  await expect(
    page.getByRole("heading", { name: "호스트 대시보드" }),
  ).toBeVisible();
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

test("host dashboard keeps first-screen menu regions readable without nested scroll boxes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const dashboardGrid =
      document.querySelector<HTMLElement>(".dashboard-grid");
    const office = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office']",
    );
    const firstStack = document.querySelector<HTMLElement>(
      ".dashboard-grid > .dashboard-stack:first-child",
    );
    const artifactPanel = document.querySelector<HTMLElement>(
      ".dashboard-grid > .dashboard-span:not(.run-panel)",
    );
    const runPanel = document.querySelector<HTMLElement>(
      ".dashboard-grid > .run-panel",
    );
    const sideStack = document.querySelector<HTMLElement>(
      ".dashboard-grid > .dashboard-stack:not(:first-child)",
    );

    if (
      mainSurface === null ||
      dashboardGrid === null ||
      office === null ||
      firstStack === null ||
      artifactPanel === null ||
      runPanel === null ||
      sideStack === null
    ) {
      throw new Error("Dashboard menu layout metrics were unavailable");
    }

    const scrollTargets = [
      ["office", office],
      ["stack", firstStack],
      ["artifact", artifactPanel],
      ["run", runPanel],
    ] as const;
    const scrollMetrics = scrollTargets.map(([name, element]) => {
      const before = element.scrollTop;
      element.scrollTop = element.scrollHeight;
      return {
        name,
        overflowY: window.getComputedStyle(element).overflowY,
        scrollTopAfterWrite: element.scrollTop,
        scrollable: element.scrollHeight > element.clientHeight + 1,
        scrollTopBeforeWrite: before,
      };
    });

    const officeRect = office.getBoundingClientRect();
    const artifactRect = artifactPanel.getBoundingClientRect();
    const runRect = runPanel.getBoundingClientRect();
    const sideRect = sideStack.getBoundingClientRect();
    const sideStyle = window.getComputedStyle(sideStack);

    return {
      dashboardOverflowY: window.getComputedStyle(dashboardGrid).overflowY,
      mainSurfaceOverflows:
        mainSurface.scrollHeight > mainSurface.clientHeight + 1,
      scrollMetrics,
      sideStack: {
        display: sideStyle.display,
        itemCount: sideStack.children.length,
        rectHeight: sideRect.height,
        rectWidth: sideRect.width,
      },
      verticalOrder: {
        artifactTop: artifactRect.top,
        officeRight: officeRect.right,
        runTop: runRect.top,
        stackLeft: firstStack.getBoundingClientRect().left,
        stackTop: firstStack.getBoundingClientRect().top,
        artifactLeft: artifactRect.left,
        runLeft: runRect.left,
      },
    };
  });

  expect(metrics.dashboardOverflowY).not.toMatch(/auto|scroll/);
  expect(metrics.mainSurfaceOverflows).toBe(false);
  expect(metrics.sideStack).toEqual({
    display: "none",
    itemCount: 0,
    rectHeight: 0,
    rectWidth: 0,
  });
  expect(metrics.scrollMetrics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "office",
        overflowY: expect.not.stringMatching(/auto|scroll/),
        scrollTopAfterWrite: 0,
      }),
      expect.objectContaining({
        name: "stack",
        overflowY: expect.not.stringMatching(/auto|scroll/),
        scrollTopAfterWrite: 0,
      }),
      expect.objectContaining({
        name: "artifact",
        overflowY: expect.not.stringMatching(/auto|scroll/),
        scrollTopAfterWrite: 0,
      }),
      expect.objectContaining({
        name: "run",
        overflowY: expect.not.stringMatching(/auto|scroll/),
        scrollTopAfterWrite: 0,
      }),
    ]),
  );
  expect(metrics.verticalOrder.stackLeft).toBeGreaterThanOrEqual(
    metrics.verticalOrder.officeRight - 1,
  );
  expect(metrics.verticalOrder.artifactLeft).toBeGreaterThanOrEqual(
    metrics.verticalOrder.officeRight - 1,
  );
  expect(metrics.verticalOrder.runLeft).toBeGreaterThanOrEqual(
    metrics.verticalOrder.officeRight - 1,
  );
  expect(metrics.verticalOrder.stackTop).toBeLessThanOrEqual(
    metrics.verticalOrder.artifactTop,
  );
  expect(metrics.verticalOrder.artifactTop).toBeLessThanOrEqual(
    metrics.verticalOrder.runTop,
  );
});

test("host dashboard keeps the office signal strip filled instead of rendering an empty lower-right box", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  const metrics = await page.evaluate(() => {
    const signalCards = Array.from(
      document.querySelectorAll<HTMLElement>(".orchestrator-office__signals > div"),
    );
    const emptySignalCards = signalCards.filter(
      (card) => (card.textContent ?? "").trim().length === 0,
    );
    const lowerRightCard = signalCards
      .map((card) => ({
        rect: card.getBoundingClientRect(),
        text: (card.textContent ?? "").replace(/\s+/g, " ").trim(),
      }))
      .sort((left, right) => right.rect.right - left.rect.right)[0];

    return {
      emptySignalCount: emptySignalCards.length,
      lowerRightText: lowerRightCard?.text,
      signalCount: signalCards.length,
    };
  });

  expect(metrics.signalCount).toBe(2);
  expect(metrics.emptySignalCount).toBe(0);
  expect(metrics.lowerRightText?.length).toBeGreaterThan(0);
});

test("host dashboard places live activity in the right rail instead of a detached lower-right box", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  const metrics = await page.evaluate(() => {
    const office = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office']",
    );
    const firstStack = document.querySelector<HTMLElement>(
      ".dashboard-grid > .dashboard-stack:first-child",
    );
    const artifactPanel = document.querySelector<HTMLElement>(
      ".dashboard-grid > .dashboard-span:not(.run-panel)",
    );
    const runPanel = document.querySelector<HTMLElement>(
      ".dashboard-grid > .run-panel",
    );
    const sideStack = document.querySelector<HTMLElement>(
      ".dashboard-grid > .dashboard-stack:not(:first-child)",
    );

    if (
      office === null ||
      firstStack === null ||
      artifactPanel === null ||
      runPanel === null ||
      sideStack === null
    ) {
      throw new Error("Live activity rail metrics were unavailable");
    }

    const activity = document.createElement("article");
    activity.className = "panel";
    activity.textContent = "에이전트 활동";
    sideStack.append(activity);

    const officeRect = office.getBoundingClientRect();
    const stackRect = firstStack.getBoundingClientRect();
    const artifactRect = artifactPanel.getBoundingClientRect();
    const runRect = runPanel.getBoundingClientRect();
    const sideRect = sideStack.getBoundingClientRect();
    const sideStyle = window.getComputedStyle(sideStack);
    sideStack.scrollTop = sideStack.scrollHeight;

    return {
      sideDisplay: sideStyle.display,
      sideLeft: sideRect.left,
      sideTop: sideRect.top,
      sideBottom: sideRect.bottom,
      sideScrollTopAfterWrite: sideStack.scrollTop,
      officeRight: officeRect.right,
      stackTop: stackRect.top,
      artifactTop: artifactRect.top,
      runTop: runRect.top,
      viewportHeight: window.innerHeight,
    };
  });

  expect(metrics.sideDisplay).not.toBe("none");
  expect(metrics.sideLeft).toBeGreaterThanOrEqual(metrics.officeRight - 1);
  expect(metrics.stackTop).toBeLessThanOrEqual(metrics.artifactTop);
  expect(metrics.artifactTop).toBeLessThanOrEqual(metrics.runTop);
  expect(metrics.runTop).toBeLessThanOrEqual(metrics.sideTop);
  expect(metrics.sideBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.sideScrollTopAfterWrite).toBe(0);
});
