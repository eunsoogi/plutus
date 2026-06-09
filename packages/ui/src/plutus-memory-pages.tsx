import { useState } from "react";

import { useI18n } from "./i18n";
import {
  commandErrorMessage,
  localizedCommandStatus,
  localizedScenarioText,
} from "./plutus-command";
import { HostShell } from "./plutus-shell";
import type { PlutusCommandClient, PlutusScenario } from "./plutus-types";

export function StrategiesPage() {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{t("strategies.title")}</h1>
      <section className="panel">
        <h2>{t("strategies.specs")}</h2>
        <p>{t("strategies.body")}</p>
      </section>
    </HostShell>
  );
}

export function MemoryPage({
  scenario,
  commandClient,
}: {
  scenario: PlutusScenario;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const [commandStatus, setCommandStatus] = useState("Ready");
  async function runMemoryCommand(
    action: "edit" | "pin" | "archive" | "forget",
  ) {
    if (!commandClient?.memory) {
      setCommandStatus("No command bridge connected");
      return;
    }
    try {
      if (action === "edit") {
        await commandClient.memory.update(
          scenario.memory.id,
          {
            summary: scenario.memory.summary,
          },
          { profileId: scenario.profileId },
        );
      } else if (action === "pin") {
        await commandClient.memory.setCategoryEnabled("research_memory", true);
      } else if (action === "archive") {
        await commandClient.memory.archive(
          scenario.memory.id,
          t("memory.archiveReason"),
          { profileId: scenario.profileId },
        );
      } else {
        await commandClient.memory.forget(scenario.memory.id, {
          profileId: scenario.profileId,
        });
      }
      setCommandStatus(`Command bridge: memory.${action}`);
    } catch (error) {
      setCommandStatus(commandErrorMessage(error));
    }
  }
  async function toggleMemoryCategory(category: string, enabled: boolean) {
    if (!commandClient?.memory) {
      setCommandStatus("No command bridge connected");
      return;
    }
    try {
      await commandClient.memory.setCategoryEnabled(category, enabled);
      setCommandStatus(`Command bridge: memory.${category}.${enabled}`);
    } catch (error) {
      setCommandStatus(commandErrorMessage(error));
    }
  }
  return (
    <HostShell>
      <h1>{t("memory.title")}</h1>
      <section className="grid two">
        <article className="panel" data-testid="memory-activity-feed">
          <h2>{t("memory.feed")}</h2>
          <p>
            {localizedScenarioText(scenario.memory.activity, t)}:{" "}
            {scenario.memory.summary}
          </p>
          <p data-testid="memory-command-status">
            {localizedCommandStatus(commandStatus, t)}
          </p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("edit")}
            >
              {t("memory.edit")}
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("pin")}
            >
              {t("memory.pin")}
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("archive")}
            >
              {t("memory.archive")}
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("forget")}
            >
              {t("memory.forget")}
            </button>
          </div>
        </article>
        <article className="panel">
          <h2>{t("memory.categories")}</h2>
          <label className="toggle-row">
            <input
              type="checkbox"
              defaultChecked
              onChange={(event) =>
                void toggleMemoryCategory(
                  "research_memory",
                  event.currentTarget.checked,
                )
              }
            />
            {t("memory.researchCapture")}
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              defaultChecked
              onChange={(event) =>
                void toggleMemoryCategory(
                  "wiki_pointer",
                  event.currentTarget.checked,
                )
              }
            />
            {t("memory.wikiPointer")}
          </label>
        </article>
      </section>
    </HostShell>
  );
}
