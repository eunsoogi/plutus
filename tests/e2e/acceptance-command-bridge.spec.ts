import { expect, test } from "@playwright/test";
import {
  commandNames,
  installCommandBridge,
} from "./orchestrator-office-fixtures";
import { captureUnexpectedPageErrors } from "./acceptance-helpers";

test("MVP command bridge backs host start, artifact fetch, and remote start", async ({
  page,
}, testInfo) => {
  const isMobileProject = testInfo.project.name === "mobile-remote";
  const unexpectedErrors = captureUnexpectedPageErrors(page);
  const callsKey = `plutusCommandCalls-${Date.now()}`;
  await installCommandBridge(page, callsKey);

  await page.goto("/runs?runtime=local");
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");
  await expect(page.getByTestId("command-source")).toHaveText("Command bridge");
  await expect(page.getByText(/Real run memory captured/)).toBeVisible();
  await expect(page.getByText(/Real run wiki/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open Real artifact/ }),
  ).toBeVisible();

  await page.goto("/runs/run-real?runtime=local");
  await expect(page.getByTestId("orchestrator-office-team-name")).toContainText(
    "Quant Strategy Desk",
  );
  const officeScene = page.getByTestId("orchestrator-office-scene");
  await expect(officeScene).toBeVisible();
  await expect
    .poll(async () => (await officeScene.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(400);
  await expect(page.getByTestId("orchestrator-office-canvas")).toBeVisible();
  await expect(page.getByTestId("orchestrator-office-canvas")).toHaveAttribute(
    "data-office-rotation",
    "south-east",
  );
  await expect(page.getByTestId("orchestrator-office-canvas")).toHaveCSS(
    "touch-action",
    "none",
  );
  if (isMobileProject) {
    await expect(
      page.getByTestId("orchestrator-office-top-controls"),
    ).toBeHidden();
    await expect(
      page.getByTestId("orchestrator-office-side-tabs"),
    ).toBeHidden();
  } else {
    await expect(
      page.getByTestId("orchestrator-office-top-controls"),
    ).toBeVisible();
    await expect(
      page.getByTestId("orchestrator-office-side-tabs"),
    ).toBeVisible();
  }
  await expect(
    page.getByTestId("orchestrator-office-event-console"),
  ).toContainText("PLUTUS EVENT CONSOLE");
  await expect(
    page.getByTestId("orchestrator-office-agent-mirror"),
  ).toHaveCount(5);
  await expect(
    page.getByTestId("orchestrator-office-canvas-mirror"),
  ).toContainText("Research Orchestrator");
  await expect(
    page.getByTestId("orchestrator-office-canvas-mirror"),
  ).toContainText("Market Data Researcher");
  await expect(
    page.getByTestId("orchestrator-office-canvas-mirror"),
  ).toContainText("Quant Strategy Researcher");
  await expect(
    page.getByTestId("orchestrator-office-canvas-mirror"),
  ).toContainText("Risk Manager");
  await expect(
    page.getByTestId("orchestrator-office-canvas-mirror"),
  ).toContainText("Report Writer");
  const canvasDiagnostics = async () =>
    page.getByTestId("orchestrator-office-canvas").evaluate((node) => {
      if (!(node instanceof HTMLCanvasElement)) {
        return {
          camera: null,
          meshCount: 0,
          pitch: null,
          renderer: null,
          webgl: false,
          yaw: null,
        };
      }

      const context = node.getContext("webgl2") ?? node.getContext("webgl");

      return {
        camera: node.getAttribute("data-office-camera"),
        meshCount: Number(node.getAttribute("data-office-mesh-count") ?? "0"),
        pitch: node.getAttribute("data-office-pitch"),
        renderer: node.getAttribute("data-office-renderer"),
        webgl: context !== null,
        yaw: node.getAttribute("data-office-yaw"),
      };
    });
  const initialCanvasDiagnostics = await canvasDiagnostics();
  expect(["three", "canvas"]).toContain(initialCanvasDiagnostics.renderer);
  if (initialCanvasDiagnostics.renderer === "three") {
    expect(initialCanvasDiagnostics.webgl).toBe(true);
    expect(initialCanvasDiagnostics.meshCount).toBeGreaterThan(20);
    expect(initialCanvasDiagnostics.camera).toMatch(/^-?\d/);
  } else {
    expect(initialCanvasDiagnostics.camera).toBeNull();
  }
  expect(initialCanvasDiagnostics.yaw).toBe("0");
  expect(initialCanvasDiagnostics.pitch).toBe("42");
  const canvasBounds = await page
    .getByTestId("orchestrator-office-canvas")
    .boundingBox();
  expect(canvasBounds).not.toBeNull();
  if (canvasBounds === null) {
    throw new Error("Office canvas bounds were not available");
  }
  const dragDistance = Math.max(canvasBounds.width * 0.28, 160);
  const dragStartX = canvasBounds.x + canvasBounds.width * 0.35;
  const dragStartY = canvasBounds.y + canvasBounds.height * 0.5;
  const dragEndX = dragStartX + dragDistance;
  const dragEndY = dragStartY - Math.max(canvasBounds.height * 0.16, 72);
  await page.mouse.move(dragStartX, dragStartY);
  await page.mouse.down();
  await page.mouse.move(dragEndX, dragEndY, { steps: 16 });
  await page.mouse.up();
  const postDragCanvas = page.getByTestId("orchestrator-office-canvas");
  if (initialCanvasDiagnostics.renderer === "three") {
    await expect
      .poll(async () => (await canvasDiagnostics()).camera)
      .not.toBe(initialCanvasDiagnostics.camera);
  } else {
    await expect
      .poll(async () => (await canvasDiagnostics()).yaw)
      .not.toBe(initialCanvasDiagnostics.yaw);
  }
  const postDragState = await canvasDiagnostics();
  expect(postDragState.pitch).not.toBe(initialCanvasDiagnostics.pitch);
  expect(postDragState.yaw).not.toBe(initialCanvasDiagnostics.yaw);
  if (postDragState.yaw !== null) {
    await expect(postDragCanvas).not.toHaveAttribute("data-office-yaw", "0");
  }
  await expect(postDragCanvas).not.toHaveAttribute(
    "data-office-rotation",
    "south-east",
  );
  await expect(
    page.getByTestId("orchestrator-office-rotation-label"),
  ).toHaveText("South West");
  await expect(page.getByTestId("orchestrator-office")).toContainText(
    "No live trading",
  );
  await expect(page.getByTestId("orchestrator-office")).toContainText(
    "Real portfolio",
  );
  await expect(page.getByTestId("orchestrator-office-team-select")).toHaveValue(
    "quant_strategy_desk",
  );
  await expect(page.getByTestId("orchestrator-office-roster")).toContainText(
    "Quant Strategy Researcher",
  );
  await page
    .getByTestId("orchestrator-office-team-select")
    .selectOption("knowledge_curation_desk");
  await expect(page.getByTestId("orchestrator-office-team-name")).toContainText(
    "Knowledge Curation Desk",
  );
  await expect(page.getByTestId("orchestrator-office-roster")).toContainText(
    "Wiki Curator",
  );
  await expect(page.getByTestId("orchestrator-office-roster")).toContainText(
    "Market desk",
  );
  await expect(
    page.getByTestId("orchestrator-office-roster"),
  ).not.toContainText("Quant Strategy Researcher");
  await expect(
    page.getByTestId("orchestrator-office-agent-mirror"),
  ).toHaveCount(3);
  await expect(page.getByTestId("final-run-card")).toContainText(
    "Real command bridge summary",
  );
  await expect(page.locator(".office-link")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileScene = page.getByTestId("orchestrator-office-scene");
  await expect(mobileScene).toBeVisible();
  await expect
    .poll(async () => (await mobileScene.boundingBox())?.height ?? 0)
    .toBeGreaterThan(480);
  await expect
    .poll(
      async () =>
        (await page.getByTestId("orchestrator-office-canvas").boundingBox())
          ?.height ?? 0,
    )
    .toBeGreaterThan(480);
  await expect(
    page.getByTestId("orchestrator-office-top-controls"),
  ).toBeHidden();
  await expect(page.getByTestId("orchestrator-office-side-tabs")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(unexpectedErrors).toEqual([]);

  await page.getByRole("link", { name: /Open Real artifact/ }).click();
  await expect(page).toHaveURL(
    /\/runs\/run-real\/artifacts\/artifact-real\?runtime=local$/,
  );
  await expect(page.getByTestId("artifact-command-source")).toHaveText(
    "Command bridge",
  );

  await page.goto("/remote/dashboard?remote=connected");
  await page.getByRole("button", { name: "Start Remote Research Run" }).click();
  await expect(page.getByTestId("remote-command-status")).toHaveText(
    "Command bridge",
  );

  await expect
    .poll(async () => {
      const names = await commandNames(page, callsKey);
      const start = names.indexOf("researchRuns.start");
      const artifact = names.indexOf("artifacts.get");
      const unlock = names.indexOf("remote.prepareUnlock");
      const remoteExecute = names.indexOf("remote.executeCommand");
      return (
        start > -1 &&
        start < artifact &&
        artifact < unlock &&
        unlock < remoteExecute
      );
    })
    .toBe(true);

  const prepareUnlockCall = await page.evaluate((storageKey) => {
    const calls = JSON.parse(
      localStorage.getItem(storageKey) ?? "[]",
    ) as Array<{
      command: string;
      args: Array<{ commandType?: string; payload?: Record<string, unknown> }>;
    }>;
    return calls.find((call) => call.command === "remote.prepareUnlock");
  }, callsKey);
  expect(prepareUnlockCall?.args[0]).toMatchObject({
    commandType: "run.start",
    payload: {
      portfolioId: "portfolio-real",
      selectedTeam: "portfolio_review_committee",
    },
  });
  expect(unexpectedErrors).toEqual([]);
});
