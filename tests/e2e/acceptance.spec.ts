import { expect, test, type Page } from "@playwright/test";
import {
  commandNames,
  installCommandBridge,
} from "./orchestrator-office-fixtures";

function captureUnexpectedPageErrors(page: Page): string[] {
  const unexpectedErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      unexpectedErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpectedErrors.push(`pageerror: ${error.message}`);
  });
  return unexpectedErrors;
}

async function syncUpbitHoldings(page: Page): Promise<void> {
  await page.goto("/settings/providers?runtime=local");
  await page.getByTestId("provider-select").selectOption("upbit");
  await page.getByTestId("credential-api-key-input").fill("upbit-api-key");
  await page.getByTestId("credential-secret-input").fill("upbit-secret");
  await page.getByTestId("credential-passphrase-input").fill("upbit-passphrase");
  await page.getByRole("button", { name: "Save provider settings" }).click();
  await expect(page.getByTestId("provider-preview-status")).toContainText(
    "Provider settings saved locally",
  );

  await page.goto("/portfolios?runtime=local");
  await expect(page.getByTestId("portfolio-provider-sync")).toContainText(
    "Ready: Upbit",
  );
  await page.getByRole("button", { name: "Sync Upbit Holdings" }).click();
  await expect(page.getByTestId("portfolio-command-status")).toContainText(
    "Synced 2 holdings from Upbit",
  );
}

test("MVP acceptance scenario queues host run and exposes mobile preview", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local");
  await page.evaluate(() => localStorage.removeItem("plutus.localRuntime.v1"));
  await syncUpbitHoldings(page);

  await page.goto("/runs?runtime=local");
  await expect(
    page.getByRole("heading", { name: "Research Runs", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");

  await page.goto("/remote/dashboard?runtime=local");
  await expect(page.getByText("Mobile Remote Controller")).toBeVisible();
  await expect(page.getByTestId("remote-command")).toContainText(
    "Start Mac-hosted run",
  );

  await page.goto("/remote/dashboard?state=revoked");
  await expect(page.getByTestId("remote-command")).toBeDisabled();
});

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
    "pan-y",
  );
  if (isMobileProject) {
    await expect(
      page.getByTestId("orchestrator-office-top-controls"),
    ).toBeHidden();
    await expect(page.getByTestId("orchestrator-office-side-tabs")).toBeHidden();
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
  const canvasSignature = async () =>
    page.getByTestId("orchestrator-office-canvas").evaluate((node) => {
      if (!(node instanceof HTMLCanvasElement)) return "";

      const context = node.getContext("2d");
      if (!context) return "";

      const samples = [
        { x: 0.32, y: 0.4 },
        { x: 0.5, y: 0.5 },
        { x: 0.68, y: 0.55 },
        { x: 0.42, y: 0.72 },
      ];
      return samples
        .map((sample) => {
          const pixel = context.getImageData(
            Math.floor(node.width * sample.x),
            Math.floor(node.height * sample.y),
            1,
            1,
          ).data;
          return `${pixel[0]}.${pixel[1]}.${pixel[2]}.${pixel[3]}`;
        })
        .join("|");
    });
  const initialCanvasSignature = await canvasSignature();
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
  await page.mouse.move(dragStartX, dragStartY);
  await page.mouse.down();
  await page.mouse.move(dragEndX, dragStartY, { steps: 16 });
  await page.mouse.up();
  await expect.poll(canvasSignature).not.toBe(initialCanvasSignature);
  const postDragCanvas = page.getByTestId("orchestrator-office-canvas");
  const postDragState = await postDragCanvas.evaluate((node) => {
    if (!(node instanceof HTMLCanvasElement)) {
      return { rotation: null, yaw: null };
    }

    return {
      rotation: node.getAttribute("data-office-rotation"),
      yaw: node.getAttribute("data-office-yaw"),
    };
  });
  if (postDragState.yaw !== null) {
    await expect(postDragCanvas).not.toHaveAttribute("data-office-yaw", "0");
  }
  if (postDragState.rotation !== null) {
    await expect(postDragCanvas).not.toHaveAttribute(
      "data-office-rotation",
      "south-east",
    );
  }
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
    .poll(async () => commandNames(page, callsKey))
    .toEqual([
      "app.getSnapshot",
      "researchRuns.start",
      "app.getSnapshot",
      "app.getSnapshot",
      "app.getSnapshot",
      "artifacts.get",
      "app.getSnapshot",
      "remote.prepareUnlock",
      "remote.executeCommand",
    ]);

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

test("orchestrator office rerenders from empty to populated run without page errors", async ({
  page,
}) => {
  const unexpectedErrors = captureUnexpectedPageErrors(page);
  await page.goto("/runs?runtime=none");

  await page.evaluate(async (workspaceRoot) => {
    type BrowserCreateElement = (
      type: unknown,
      props?: unknown,
      ...children: unknown[]
    ) => unknown;
    type BrowserReactModule = {
      readonly createElement?: BrowserCreateElement;
      readonly default: { readonly createElement: BrowserCreateElement };
    };
    type BrowserRoot = { readonly render: (node: unknown) => void };
    type BrowserReactDomClientModule = {
      readonly createRoot?: (container: Element) => BrowserRoot;
      readonly default: {
        readonly createRoot: (container: Element) => BrowserRoot;
      };
    };
    const importReactRuntime = (
      path: string,
    ): Promise<BrowserReactModule> => import(path);
    const importReactDomClientRuntime = (
      path: string,
    ): Promise<BrowserReactDomClientModule> => import(path);
    const reactModulePath = "/node_modules/.vite/deps/react.js";
    const reactDomClientModulePath =
      "/node_modules/.vite/deps/react-dom_client.js";
    const [reactModule, reactDomClientModule, { I18nProvider }, officeModule] =
      await Promise.all([
        importReactRuntime(reactModulePath),
        importReactDomClientRuntime(reactDomClientModulePath),
        import(`${workspaceRoot}/packages/ui/src/i18n.tsx`),
        import(`${workspaceRoot}/packages/ui/src/orchestrator-office.tsx`),
      ]);
    const createElement =
      reactModule.createElement ?? reactModule.default.createElement;
    const createRoot =
      reactDomClientModule.createRoot ??
      reactDomClientModule.default.createRoot;
    const rootElement = document.createElement("div");
    document.body.replaceChildren(rootElement);
    const root = createRoot(rootElement);
    const emptyRun = {
      category: "",
      id: "",
      status: "ready",
      title: "Pending run",
    };
    const populatedRun = {
      category: "risk_warning",
      finalCard: {
        riskChecklist: [{ check: "Concentration", status: "warning" }],
        selectedTeam: "portfolio_review_committee",
        supportingEvidence: [{ label: "Real portfolio" }],
      },
      id: "run-real",
      status: "completed",
      title: "BTC and NVDA risk review",
    };
    const renderOffice = (run: typeof emptyRun | typeof populatedRun) => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(officeModule.OrchestratorOffice, { run }),
        ),
      );
    };
    const waitForRender = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

    renderOffice(emptyRun);
    await waitForRender();
    renderOffice(populatedRun);
    await waitForRender();
  }, `/@fs${process.cwd()}`);

  await expect(page.getByTestId("orchestrator-office")).toBeVisible();
  await expect(page.getByTestId("orchestrator-office-team-name")).toContainText(
    "Portfolio Review Committee",
  );
  expect(unexpectedErrors).toEqual([]);
});
