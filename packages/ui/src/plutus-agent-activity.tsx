import { useI18n } from "./i18n";
import { localizedScenarioText } from "./plutus-command";
import type { PlutusScenario } from "./plutus-types";

export function AgentActivityPanel({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  const symbolList =
    scenario.portfolio.positions
      .map((position) => position.symbol)
      .join(", ") || t("common.none");
  const lanes = [
    [t("agentActivity.market"), t("stage.grounding"), symbolList],
    [t("agentActivity.quant"), t("stage.executing"), scenario.run.title],
    [
      t("agentActivity.risk"),
      t("stage.validating"),
      scenario.run.category || t("common.none"),
    ],
    [
      t("agentActivity.report"),
      t("stage.reporting"),
      localizedScenarioText(scenario.run.artifacts[0]?.name, t) ||
        t("artifact.none"),
    ],
  ] as const;
  return (
    <article className="panel">
      <h2>{t("agentActivity.title")}</h2>
      <div className="agent-lanes">
        {lanes.map(([agent, stage, detail]) => (
          <div className="agent-lane" key={agent}>
            <strong>{agent}</strong>
            <span>
              {stage} - {detail}
            </span>
            <i className="agent-dot" aria-hidden="true" />
          </div>
        ))}
      </div>
    </article>
  );
}
