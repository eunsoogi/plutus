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

test("host dashboard keeps the side stack in the desktop side area with internal recovery scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const sideStack = document.querySelector<HTMLElement>(
      ".dashboard-grid > .dashboard-stack:not(:first-child)",
    );

    if (mainSurface === null || sideStack === null) {
      throw new Error("Side stack recovery metrics were unavailable");
    }

    const beforeStyle = window.getComputedStyle(sideStack);
    for (let index = 0; index < 10; index += 1) {
      const filler = document.createElement("article");
      filler.className = "panel";
      filler.textContent = `recovery filler ${index + 1}`;
      filler.style.minHeight = "11rem";
      sideStack.append(filler);
    }

    const afterStyle = window.getComputedStyle(sideStack);
    const mainSurfaceScrollTopBefore = mainSurface.scrollTop;
    sideStack.scrollTop = sideStack.scrollHeight;

    return {
      gridArea: beforeStyle.gridArea,
      minHeight: beforeStyle.minHeight,
      overflowY: afterStyle.overflowY,
      sideHasOverflow: sideStack.scrollHeight > sideStack.clientHeight + 1,
      sideScrolled: sideStack.scrollTop > 0,
      mainSurfaceScrollTopBefore,
      mainSurfaceScrollTopAfter: mainSurface.scrollTop,
      mainSurfaceOverflows:
        mainSurface.scrollHeight > mainSurface.clientHeight + 1,
    };
  });

  expect(metrics.gridArea).toBe("side");
  expect(metrics.minHeight).toBe("0px");
  expect(["auto", "scroll"]).toContain(metrics.overflowY);
  expect(metrics.sideHasOverflow).toBe(true);
  expect(metrics.sideScrolled).toBe(true);
  expect(metrics.mainSurfaceScrollTopBefore).toBe(0);
  expect(metrics.mainSurfaceScrollTopAfter).toBe(0);
  expect(metrics.mainSurfaceOverflows).toBe(false);
});

test("host dashboard keeps vertical recovery scroll when header pills wrap beyond the desktop fixture", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const header = document.querySelector<HTMLElement>(".page-header");
    const pillRow = document.querySelector<HTMLElement>(".page-header .pill-row");
    const runPanel = document.querySelector<HTMLElement>(".run-panel");

    if (
      mainSurface === null ||
      header === null ||
      pillRow === null ||
      runPanel === null
    ) {
      throw new Error("Dashboard recovery metrics were unavailable");
    }

    for (let index = 0; index < 20; index += 1) {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.style.minWidth = "20rem";
      pill.textContent = `장기 포트폴리오 상태 ${index + 1} / 알림 확장 / 시장 감시 / 수익률 복구`;
      pillRow.append(pill);
    }

    header.style.minHeight = "30rem";

    const overflowY = window.getComputedStyle(mainSurface).overflowY;
    const scrollHeight = mainSurface.scrollHeight;
    const clientHeight = mainSurface.clientHeight;
    const runPanelBottomBeforeScroll = runPanel.getBoundingClientRect().bottom;

    mainSurface.scrollTop = scrollHeight;

    return {
      overflowY,
      scrolled: mainSurface.scrollTop > 0,
      hasVerticalOverflow: scrollHeight > clientHeight + 1,
      runPanelBottomAfterScroll: runPanel.getBoundingClientRect().bottom,
      runPanelBottomBeforeScroll,
      viewportHeight: window.innerHeight,
    };
  });

  expect(["auto", "scroll"]).toContain(metrics.overflowY);
  expect(metrics.hasVerticalOverflow).toBe(true);
  expect(metrics.scrolled).toBe(true);
  expect(metrics.runPanelBottomBeforeScroll).toBeGreaterThan(
    metrics.viewportHeight,
  );
  expect(metrics.runPanelBottomAfterScroll).toBeLessThanOrEqual(
    metrics.viewportHeight,
  );
});

test("host dashboard recovers clipped office content at 1280x800 with internal panel scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard?runtime=local&locale=ko");

  const metrics = await page.evaluate(() => {
    const mainSurface = document.querySelector<HTMLElement>(".main-surface");
    const office = document.querySelector<HTMLElement>(
      "[data-testid='orchestrator-office']",
    );
    const officeSignals = document.querySelector<HTMLElement>(
      ".orchestrator-office__signals",
    );

    if (mainSurface === null || office === null || officeSignals === null) {
      throw new Error("Office recovery metrics were unavailable");
    }

    for (let index = 0; index < 6; index += 1) {
      const signal = document.createElement("div");
      const label = document.createElement("span");
      const detail = document.createElement("strong");
      label.textContent = `recovery signal ${index + 1}`;
      detail.textContent = `office overflow ${index + 1}`;
      signal.style.minHeight = "6rem";
      signal.append(label, detail);
      officeSignals.append(signal);
    }

    const officeRect = office.getBoundingClientRect();
    const lastSignal = officeSignals.lastElementChild;
    if (!(lastSignal instanceof HTMLElement)) {
      throw new Error("Office recovery signal was unavailable");
    }

    const lastSignalBottomBeforeScroll = lastSignal.getBoundingClientRect().bottom;
    const officeOverflowY = window.getComputedStyle(office).overflowY;
    office.scrollTop = office.scrollHeight;

    return {
      bodyOverflows:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      mainSurfaceOverflows:
        mainSurface.scrollHeight > mainSurface.clientHeight + 1,
      officeOverflowY,
      officeHasOverflow: office.scrollHeight > office.clientHeight + 1,
      officeScrolled: office.scrollTop > 0,
      lastSignalBottomAfterScroll: lastSignal.getBoundingClientRect().bottom,
      lastSignalBottomBeforeScroll,
      officeBottom: officeRect.bottom,
    };
  });

  expect(metrics.bodyOverflows).toBe(false);
  expect(metrics.mainSurfaceOverflows).toBe(false);
  expect(["auto", "scroll"]).toContain(metrics.officeOverflowY);
  expect(metrics.officeHasOverflow).toBe(true);
  expect(metrics.lastSignalBottomBeforeScroll).toBeGreaterThan(metrics.officeBottom);
  expect(metrics.officeScrolled).toBe(true);
  expect(metrics.lastSignalBottomAfterScroll).toBeLessThanOrEqual(
    metrics.officeBottom - 8,
  );
});
