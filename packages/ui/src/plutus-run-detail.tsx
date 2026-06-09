import { useEffect, useState } from "react";

import { useI18n } from "./i18n";
import { OrchestratorOffice } from "./orchestrator-office";
import { ArtifactList, RiskChart, RiskWarning } from "./plutus-dashboard";
import {
  commandErrorMessage,
  localizedCommandSource,
  localizedScenarioText,
} from "./plutus-command";
import { FinalRunCard } from "./plutus-runs";
import { HostShell } from "./plutus-shell";
import type { PlutusCommandClient, PlutusScenario } from "./plutus-types";

export function RunStageList() {
  const { t } = useI18n();
  const stages = [
    ["planning", t("stage.planning")],
    ["grounding", t("stage.grounding")],
    ["executing", t("stage.executing")],
    ["debating", t("stage.debating")],
    ["validating", t("stage.validating")],
    ["reporting", t("stage.reporting")],
    ["completed", t("stage.completed")],
  ] as const;
  return (
    <ol data-testid="run-progress">
      {stages.map(([stage, label]) => (
        <li key={stage}>{label}</li>
      ))}
    </ol>
  );
}

export function RunDetailPage({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  const showStaticRiskVisual = Boolean(
    scenario.run.category && !scenario.run.finalCard,
  );
  return (
    <HostShell>
      <h1>{localizedScenarioText(scenario.run.title, t)}</h1>
      {showStaticRiskVisual ? (
        <>
          <RiskChart />
          <RiskWarning />
        </>
      ) : null}
      <OrchestratorOffice run={scenario.run} />
      {scenario.run.finalCard ? (
        <FinalRunCard
          run={scenario.run}
          status={localizedScenarioText(scenario.run.status, t)}
        />
      ) : null}
      <ArtifactList scenario={scenario} />
    </HostShell>
  );
}

export function ArtifactDetailPage({
  scenario,
  commandClient,
  artifactId = scenario.run.artifacts[0]?.id ?? "",
  runId = scenario.run.id,
}: {
  scenario: PlutusScenario;
  commandClient?: PlutusCommandClient;
  artifactId?: string;
  runId?: string;
}) {
  const { t } = useI18n();
  const fallbackArtifact = artifactId
    ? (scenario.run.artifacts.find(
        (artifact) => artifact.id === artifactId,
      ) ?? { id: "", name: t("empty.artifact"), type: "" })
    : (scenario.run.artifacts[0] ?? {
        id: "",
        name: t("empty.artifact"),
        type: "",
      });
  const [artifactName, setArtifactName] = useState(
    localizedScenarioText(fallbackArtifact.name, t),
  );
  const [commandSource, setCommandSource] = useState<
    "Command bridge" | "Local runtime"
  >("Local runtime");

  useEffect(() => {
    if (!commandClient) return;
    let active = true;
    commandClient.artifacts
      .get(artifactId, { profileId: scenario.profileId, runId })
      .then((artifact) => {
        if (!active) return;
        setArtifactName(
          localizedScenarioText(
            artifact.title ?? artifact.name ?? fallbackArtifact.name,
            t,
          ),
        );
        setCommandSource("Command bridge");
      })
      .catch(() => {
        if (active) setCommandSource("Local runtime");
      });
    return () => {
      active = false;
    };
  }, [
    artifactId,
    commandClient,
    fallbackArtifact.name,
    runId,
    scenario.profileId,
  ]);

  return (
    <HostShell>
      <h1>{artifactName}</h1>
      {scenario.run.category ? <RiskWarning /> : null}
      <p data-testid="artifact-command-source">
        {localizedCommandSource(commandSource, t)}
      </p>
      <p data-testid="artifact-command-title">{artifactName}</p>
      <p>{t("artifact.generated")}</p>
    </HostShell>
  );
}
