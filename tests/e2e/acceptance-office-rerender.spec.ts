import { expect, test } from "@playwright/test";
import { captureUnexpectedPageErrors } from "./acceptance-helpers";

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
