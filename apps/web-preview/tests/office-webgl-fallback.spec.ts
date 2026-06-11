import { expect, test } from "@playwright/test";
import { captureUnexpectedPageErrors } from "../../../tests/e2e/acceptance-helpers";

test("office keeps a non-WebGL canvas and semantic mirror when WebGL is unavailable", async ({
  page,
}) => {
  const unexpectedErrors = captureUnexpectedPageErrors(page);
  await page.addInitScript(() => {
    localStorage.removeItem("plutus.localRuntime.v1");
    const canvasPrototype = HTMLCanvasElement.prototype as {
      getContext: (
        contextId: string,
        options?: unknown,
      ) => RenderingContext | null;
    };
    const originalGetContext = canvasPrototype.getContext;
    canvasPrototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      options?: unknown,
    ) {
      const lowerContextId = contextId.toLowerCase();

      if (
        lowerContextId === "webgl" ||
        lowerContextId === "webgl2" ||
        lowerContextId === "experimental-webgl"
      ) {
        return null;
      }

      return originalGetContext.call(this, contextId, options);
    };
  });

  await page.goto("/office?runtime=local");

  const officeCanvas = page.getByTestId("orchestrator-office-canvas");
  await expect(officeCanvas).toBeVisible();
  await expect(officeCanvas).toHaveAttribute("data-office-renderer", "canvas");
  await expect(officeCanvas).toHaveAttribute(
    "data-office-rotation",
    "south-east",
  );
  await expect(
    page.getByTestId("orchestrator-office-canvas-mirror"),
  ).toContainText("Research Orchestrator");
  await expect(
    page.getByTestId("orchestrator-office-canvas-mirror"),
  ).toContainText("Market Data Researcher");
  expect(unexpectedErrors).toEqual([]);
});
