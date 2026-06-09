import { expect, test } from "@playwright/test";
test("wiki detail exposes diff and revision metadata for real wiki state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-wiki",
          portfolios: [],
          watchlists: [],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [
            {
              id: "wiki-btc-nvda-concentration",
              title: "Wiki Page",
              currentRevisionId: "audit-wiki-btc-nvda-revision",
              diffBody: "Added concentration lesson and stale quote warning.",
              sourceRefs: [{ type: "run", id: "run-btc-nvda" }],
            },
          ],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });
  await page.goto("/wiki/wiki-btc-nvda-concentration?runtime=local");
  await expect(page.getByTestId("wiki-diff-view")).toContainText(
    "stale quote warning",
  );
  await expect(page.getByTestId("wiki-revision-timeline")).toContainText(
    "audit",
  );
});

test("wiki detail uses the routed wiki page when multiple pages exist", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-wiki",
          portfolios: [],
          watchlists: [],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [
            {
              id: "wiki-first",
              title: "First Wiki",
              currentRevisionId: "revision-first",
              revisionNote: "First page revision note.",
              sourceRefs: [],
            },
            {
              id: "wiki-target",
              title: "Target Wiki",
              currentRevisionId: "revision-target",
              revisionNote: "Target page revision note.",
              sourceRefs: [],
            },
          ],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });
  await page.goto("/wiki/wiki-target");

  await expect(
    page.getByRole("heading", { name: "Target Wiki", level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId("wiki-diff-view")).toContainText(
    "Target page revision note.",
  );
  await expect(page.getByText("First page revision note.")).toHaveCount(0);
});
