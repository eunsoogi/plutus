import type { NamespaceHandler } from "./common";
import { allowFixtureTools, ok, warning, writeDurableJson } from "./common";
import type {
  LocalToolResponse,
  LocalToolWarning,
  SourceRef,
} from "../schemas/envelope";
import {
  checkConcentration,
  checkLiquidity,
  computeCorrelation,
  computeDrawdown,
  computeVolatility,
  runScenario,
} from "./risk-calculations";
import { RISK_SOURCE_REFS } from "./risk-fixtures";

export const handleRisk: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  if (call.tool === "register_risk_veto") {
    const veto = {
      runId: context.runId,
      profileId: context.profileId,
      ...(call.input as object),
    };
    const path = writeDurableJson(
      runtime,
      context,
      ["risk", `veto-${context.runId}.json`],
      veto,
    );
    runtime.records.set(`risk_veto_${context.runId}`, veto);
    return ok(auditRef, "plutus_risk", { ...veto, path }, [
      warning(
        "risk_veto_registered",
        "blocking",
        "Risk veto was durably recorded.",
      ),
    ]);
  }

  if (!allowFixtureTools()) {
    return riskOk(
      auditRef,
      undefined,
      [],
      [
        warning(
          "risk_provider_not_configured",
          "blocking",
          "Risk analytics providers are not configured for local runtime; deterministic fixtures require PLUTUS_ALLOW_FIXTURE_TOOLS=1.",
        ),
      ],
    );
  }

  switch (call.tool) {
    case "compute_correlation":
      return riskOk(auditRef, computeCorrelation(call.input), [
        RISK_SOURCE_REFS.returns,
      ]);
    case "compute_volatility": {
      const data = computeVolatility(call.input);
      return riskOk(
        auditRef,
        data,
        [RISK_SOURCE_REFS.returns],
        [
          ...(data.volatility.realizedVolatilityPct > 45
            ? [
                warning(
                  "high_realized_volatility",
                  "warning",
                  `${data.volatility.symbol} realized volatility is elevated in the MVP fixture window.`,
                  [`risk_fixture_return_series:${data.volatility.symbol}`],
                ),
              ]
            : []),
        ],
      );
    }
    case "compute_drawdown":
      return riskOk(
        auditRef,
        { drawdown: computeDrawdown(call.input) },
        [RISK_SOURCE_REFS.returns],
        [
          warning(
            "open_drawdown_warning",
            "warning",
            "The fixture drawdown period has not fully recovered.",
            ["risk_fixture_return_series:portfolio-core"],
          ),
        ],
      );
    case "check_concentration": {
      const data = checkConcentration(call.input);
      return riskOk(
        auditRef,
        data,
        [RISK_SOURCE_REFS.portfolio],
        [
          ...data.breaches.map((breach) =>
            warning(
              "concentration_limit_breach",
              "warning",
              `${breach.label} exceeds the configured concentration limit.`,
              [breach.evidenceRef],
            ),
          ),
        ],
      );
    }
    case "check_liquidity": {
      const data = checkLiquidity(call.input);
      return riskOk(
        auditRef,
        data,
        [RISK_SOURCE_REFS.liquidity],
        [
          ...data.liquidity
            .filter((row) => row.orderSizeUsd > row.capacityWarningThreshold)
            .map((row) =>
              warning(
                "liquidity_sizing_warning",
                "warning",
                `${row.symbol} order size is above the deterministic liquidity fixture threshold.`,
                [`risk_fixture_liquidity:${row.symbol}`],
              ),
            ),
        ],
      );
    }
    case "run_scenario": {
      const data = runScenario(call.input);
      return riskOk(
        auditRef,
        data,
        [RISK_SOURCE_REFS.scenario],
        [
          warning(
            "scenario_loss_warning",
            "warning",
            `${data.scenario.name} produces a material portfolio loss in deterministic fixtures.`,
            ["risk_fixture_scenarios:liquidity_crunch"],
          ),
        ],
      );
    }
    default:
      return riskOk(
        auditRef,
        undefined,
        [RISK_SOURCE_REFS.portfolio],
        [
          warning(
            "unsupported_risk_tool",
            "blocking",
            `${call.tool} is not implemented by plutus_risk fixtures.`,
          ),
        ],
      );
  }
};

function riskOk(
  auditRef: string,
  data: unknown,
  sourceRefs: SourceRef[],
  warnings: LocalToolWarning[] = [],
): LocalToolResponse {
  return {
    ok: true,
    data,
    sourceRefs,
    warnings,
    auditRef,
  };
}

function round(value: number, decimals = 2): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
