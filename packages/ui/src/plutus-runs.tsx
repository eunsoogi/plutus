import { useEffect, useState } from "react";

import { useI18n } from "./i18n";
import { ArtifactList, RiskWarning } from "./plutus-dashboard";
import {
  commandErrorMessage,
  commandSourceForRuntime,
  commandStatusLabel,
  hasVisibleResearchRun,
  localizedCommandSource,
  localizedScenarioText,
} from "./plutus-command";
import type { CommandSource } from "./plutus-command";
import { HostShell } from "./plutus-shell";
import type { PlutusCommandClient, PlutusScenario } from "./plutus-types";
import { RunStageList } from "./plutus-run-detail";

export function RunsPage({
  scenario,
  commandClient,
  refreshScenario,
}: {
  scenario: PlutusScenario;
  commandClient?: PlutusCommandClient;
  refreshScenario?: () => Promise<PlutusScenario>;
}) {
  const { t } = useI18n();
  const [currentScenario, setCurrentScenario] = useState(scenario);
  const [started, setStarted] = useState(false);
  const [pending, setPending] = useState(false);
  const [runStatus, setRunStatus] = useState(
    localizedScenarioText(scenario.run.status, t),
  );
  const [commandSource, setCommandSource] = useState<CommandSource>(() =>
    commandSourceForRuntime(commandClient),
  );
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentScenario(scenario);
    setRunStatus(localizedScenarioText(scenario.run.status, t));
    if (hasVisibleResearchRun(scenario.run)) {
      setCommandSource(commandSourceForRuntime(commandClient));
    }
  }, [commandClient, scenario, t]);
  const visibleRunStarted =
    started || hasVisibleResearchRun(currentScenario.run);

  async function startReview() {
    setCommandError(null);
    if (!commandClient || !currentScenario.portfolio.id) {
      setCommandError(t("runs.createFirst"));
      return;
    }

    setPending(true);
    try {
      const run = await commandClient.researchRuns.start({
        profileId: currentScenario.profileId,
        portfolioId: currentScenario.portfolio.id,
        symbols: currentScenario.portfolio.positions.map(
          (position) => position.symbol,
        ),
        selectedTeam: "portfolio_review_committee",
        userRequest: `Start review for ${currentScenario.portfolio.name}`,
      });
      const refreshedScenario = refreshScenario
        ? await refreshScenario()
        : currentScenario;
      setCurrentScenario(refreshedScenario);
      setStarted(true);
      setRunStatus(
        localizedScenarioText(
          commandStatusLabel(run.status, refreshedScenario.run.status),
          t,
        ),
      );
      setCommandSource(commandSourceForRuntime(commandClient));
      if (refreshScenario) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          const updatedScenario = await refreshScenario();
          setCurrentScenario(updatedScenario);
          setRunStatus(
            localizedScenarioText(
              commandStatusLabel(run.status, updatedScenario.run.status),
              t,
            ),
          );
          if (
            updatedScenario.run.category ||
            ["completed", "failed", "cancelled"].includes(
              updatedScenario.run.status,
            )
          ) {
            break;
          }
        }
      }
    } catch (error) {
      setCommandError(commandErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <HostShell>
      <h1>{t("runs.title")}</h1>
      <h2>{t("runs.title")}</h2>
      <button
        className="primary"
        onClick={startReview}
        disabled={pending || !currentScenario.portfolio.id}
      >
        {pending ? t("runs.starting") : t("runs.start")}
      </button>
      {commandError ? (
        <section className="risk-warning" data-testid="command-error">
          {commandError}
        </section>
      ) : null}
      <section className="panel run-panel">
        {visibleRunStarted ? (
          <>
            <div data-testid="run-progress">{runStatus}</div>
            <div data-testid="command-source">
              {localizedCommandSource(commandSource, t)}
            </div>
          </>
        ) : (
          <RunStageList />
        )}
        {currentScenario.run.category ? <RiskWarning /> : null}
        <FinalRunCard
          run={currentScenario.run}
          started={visibleRunStarted}
          status={runStatus}
        />
        <ArtifactList scenario={currentScenario} />
      </section>
      <section className="panel">
        <h2>{t("memory.short")}</h2>
        <p>
          {currentScenario.memory.summary
            ? `${currentScenario.memory.activity}: ${currentScenario.memory.summary}`
            : t("memory.empty")}
        </p>
      </section>
      <section className="panel">
        <h2>{t("wiki.short")}</h2>
        <p>
          {currentScenario.wiki.title
            ? `${currentScenario.wiki.title} with source-linked revision history.`
            : t("wiki.empty")}
        </p>
      </section>
    </HostShell>
  );
}

export function FinalRunCard({
  run,
  started,
  status,
}: {
  run: PlutusScenario["run"];
  started?: boolean;
  status: string;
}) {
  const card = run.finalCard;
  const evidence = card?.supportingEvidence ?? [];
  const checklist = card?.riskChecklist ?? [];
  const { t } = useI18n();
  return (
    <div data-testid="final-run-card" className="final-card">
      <strong>
        {started ? t("runs.status", { status }) : ""}
        {t("runs.finalCategory", {
          category: run.category || t("common.none"),
        })}
      </strong>
      {run.confidence ? (
        <span>{t("runs.confidence", { confidence: run.confidence })}</span>
      ) : null}
      {card?.summary ? <p>{card.summary}</p> : null}
      {evidence.length > 0 ? (
        <ul>
          {evidence.slice(0, 3).map((item, index) => (
            <li key={`${item.sourceRef ?? item.label ?? index}`}>
              {item.label ?? item.sourceRef}
            </li>
          ))}
        </ul>
      ) : null}
      {checklist.length > 0 ? (
        <p>
          {t("runs.riskChecks", {
            checks: checklist
              .slice(0, 3)
              .map(
                (item) =>
                  `${item.check ?? t("common.check")}=${item.status ?? t("common.unknown")}`,
              )
              .join(", "),
          })}
        </p>
      ) : null}
      {card?.limitations?.length ? (
        <p>
          {t("runs.limitations", { limitations: card.limitations.join("; ") })}
        </p>
      ) : null}
      {card?.nextActions?.length ? (
        <p>{t("runs.next", { next: card.nextActions.join("; ") })}</p>
      ) : null}
    </div>
  );
}
