import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __PLUTUS_COMMAND_BRIDGE__?: (envelope: {
      command: string;
      args: unknown[];
    }) => Promise<unknown>;
  }
}

export async function installCommandBridge(
  page: Page,
  key: string,
): Promise<void> {
  await page.addInitScript((storageKey) => {
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
      const calls = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      calls.push(envelope);
      localStorage.setItem(storageKey, JSON.stringify(calls));
      const runStarted =
        localStorage.getItem(`${storageKey}:runStarted`) === "1";

      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-real",
          portfolios: [
            {
              id: "portfolio-real",
              name: "Real Portfolio",
              baseCurrency: "USD",
              positions: [
                {
                  id: "position-real",
                  symbol: "AAPL",
                  name: "Apple Inc.",
                  quantity: 3,
                  averageCost: 100,
                  thesis: "Real persisted position",
                },
              ],
            },
          ],
          watchlists: [],
          runs: [
            {
              id: "run-real",
              portfolioId: "portfolio-real",
              selectedTeam: "quant_strategy_desk",
              status: runStarted ? "completed" : "ready",
              title: "Real portfolio review",
              category: runStarted ? "risk_warning" : "",
              finalCard: runStarted
                ? {
                    recommendationCategory: "risk_warning",
                    title: "Real portfolio review",
                    userRequest: "Review real persisted portfolio",
                    selectedTeam: "portfolio_review_committee",
                    summary: "Real command bridge summary",
                    confidence: "medium",
                    warnings: ["Read-only review"],
                    supportingEvidence: [
                      { label: "Real portfolio", sourceRef: "portfolio-real" },
                    ],
                    riskChecklist: [
                      { check: "No live trading", status: "passed" },
                    ],
                    limitations: ["Preview command bridge"],
                    nextActions: ["Open artifact"],
                  }
                : undefined,
            },
          ],
          artifacts: runStarted
            ? [
                {
                  id: "artifact-real",
                  researchRunId: "run-real",
                  title: "Real artifact",
                  type: "report",
                },
              ]
            : [],
          memoryActivity: runStarted
            ? [
                {
                  id: "memory-activity-real",
                  memoryId: "memory-real",
                  eventType: "memory.captured",
                  payload: { summary: "Real run memory captured" },
                },
              ]
            : [],
          wikiPages: runStarted
            ? [
                {
                  id: "wiki-real",
                  title: "Real run wiki",
                  currentRevisionId: "revision-real",
                  sourceRefs: ["run-real"],
                },
              ]
            : [],
          remoteDevices: [{ name: "Real iPhone" }],
        };
      }

      if (envelope.command === "researchRuns.start") {
        localStorage.setItem(`${storageKey}:runStarted`, "1");
        return {
          id: "run-real",
          status: "queued",
          portfolioId: "portfolio-real",
        };
      }

      if (envelope.command === "artifacts.get") {
        return {
          id: "artifact-real",
          title: "Real artifact",
          type: "report",
        };
      }

      if (envelope.command === "remote.prepareUnlock") {
        return {
          sessionId: "session-real",
          sessionKeyRef: "secure://session-real",
          unlockProof: {
            method: "biometric",
            sessionKeyRef: "secure://session-real",
            challenge: "ed25519:test",
          },
        };
      }

      if (envelope.command === "remote.executeCommand") {
        return {
          authorization: {
            success: true,
            permissionGranted: true,
            warnings: [],
          },
          data: { ok: true },
        };
      }

      throw new Error(`Unexpected command ${envelope.command}`);
    };
  }, key);
}

export async function commandNames(page: Page, key: string): Promise<string[]> {
  return page.evaluate(
    (storageKey) =>
      JSON.parse(localStorage.getItem(storageKey) ?? "[]").map(
        (call: { command: string }) => call.command,
      ),
    key,
  );
}
