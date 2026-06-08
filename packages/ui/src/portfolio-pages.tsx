import { useEffect, useState, type FormEvent } from "react";

import { useI18n } from "./i18n";
import {
  type AddPortfolioPositionInput,
  parsePositionEntryForm,
} from "./portfolio-position-entry";
import {
  emptyPositionForm,
  PositionEntryForm,
  type PositionFormState,
} from "./portfolio-position-entry-form";
import { PortfolioRows } from "./portfolio-rows";
import {
  HostShell,
  localizedScenarioText,
  type PlutusCommandClient,
  type PlutusScenario,
} from "./plutus-app";

type PortfolioPosition = PlutusScenario["portfolio"]["positions"][number];

export function PortfoliosPage({
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
  const [creating, setCreating] = useState(false);
  const [addingPosition, setAddingPosition] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdPortfolio, setCreatedPortfolio] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [localPositions, setLocalPositions] = useState<PortfolioPosition[]>([]);
  const [positionForm, setPositionForm] =
    useState<PositionFormState>(emptyPositionForm);

  useEffect(() => {
    setCurrentScenario(scenario);
    setLocalPositions([]);
  }, [scenario]);

  const visibleScenario = scenarioWithLocalPortfolio(
    currentScenario,
    createdPortfolio,
    localPositions,
  );

  async function refreshVisibleScenario() {
    if (!refreshScenario) return null;
    const refreshedScenario = await refreshScenario();
    setCurrentScenario(refreshedScenario);
    return refreshedScenario;
  }

  async function createPortfolio() {
    setMessage(null);
    if (!commandClient?.portfolios?.create) {
      setMessage(t("portfolio.bridgeMissing"));
      return;
    }
    setCreating(true);
    try {
      const created = await commandClient.portfolios.create({
        profileId: scenario.profileId,
        name: t("portfolio.defaultName"),
        baseCurrency: "USD",
      });
      if (created.id) {
        const createdName = localizedScenarioText(
          created.name ?? t("portfolio.defaultName"),
          t,
        );
        setCreatedPortfolio({
          id: created.id,
          name: createdName,
        });
      }
      await refreshVisibleScenario();
      setMessage(
        t("portfolio.created", {
          name: localizedScenarioText(
            created.name ?? t("portfolio.defaultName"),
            t,
          ),
        }),
      );
    } catch (error) {
      setMessage(commandErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function addPosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!commandClient?.portfolios?.addPosition) {
      setMessage(t("portfolio.bridgeMissing"));
      return;
    }

    const parsed = parsePositionEntryForm({
      ...positionForm,
      portfolioId: visibleScenario.portfolio.id,
      ...(visibleScenario.profileId
        ? { profileId: visibleScenario.profileId }
        : {}),
    });
    if (!parsed.ok) {
      setMessage(t(parsed.messageKey));
      return;
    }

    setAddingPosition(true);
    try {
      const added = await commandClient.portfolios.addPosition(parsed.input);
      const fallbackPosition = positionFromAddResult(parsed.input, added);
      const refreshedScenario = await refreshVisibleScenario();
      if (!refreshedScenario) {
        setLocalPositions((positions) => [...positions, fallbackPosition]);
      }
      setPositionForm(emptyPositionForm);
      setMessage(
        t("portfolio.positionAdded", { symbol: parsed.input.symbol }),
      );
    } catch (error) {
      setMessage(commandErrorMessage(error));
    } finally {
      setAddingPosition(false);
    }
  }

  function updatePositionForm(field: keyof PositionFormState, value: string) {
    setPositionForm((form) => ({ ...form, [field]: value }));
  }

  return (
    <HostShell>
      <h1>{t("portfolio.title")}</h1>
      {!visibleScenario.portfolio.id ? (
        <section className="panel">
          <h2>{t("portfolio.create")}</h2>
          <button
            className="primary"
            onClick={createPortfolio}
            disabled={creating}
          >
            {creating ? t("portfolio.creating") : t("portfolio.create")}
          </button>
        </section>
      ) : (
        <PositionEntryForm
          addingPosition={addingPosition}
          form={positionForm}
          onSubmit={addPosition}
          onUpdate={updatePositionForm}
        />
      )}
      {message ? <p data-testid="portfolio-command-status">{message}</p> : null}
      <PortfolioRows scenario={visibleScenario} />
    </HostShell>
  );
}

function scenarioWithLocalPortfolio(
  scenario: PlutusScenario,
  createdPortfolio: { readonly id: string; readonly name: string } | null,
  localPositions: readonly PortfolioPosition[],
): PlutusScenario {
  const scenarioWithPortfolio =
    !scenario.portfolio.id && createdPortfolio
      ? {
          ...scenario,
          portfolio: {
            ...scenario.portfolio,
            id: createdPortfolio.id,
            name: createdPortfolio.name,
          },
        }
      : scenario;
  if (!localPositions.length) return scenarioWithPortfolio;

  const existingKeys = new Set(
    scenarioWithPortfolio.portfolio.positions.map(
      (position) => position.id ?? position.symbol,
    ),
  );
  const positions = [
    ...scenarioWithPortfolio.portfolio.positions,
    ...localPositions.filter(
      (position) => !existingKeys.has(position.id ?? position.symbol),
    ),
  ];
  return {
    ...scenarioWithPortfolio,
    portfolio: {
      ...scenarioWithPortfolio.portfolio,
      positions,
      value: positions.reduce((total, position) => total + position.value, 0),
    },
  };
}

function positionFromAddResult(
  input: AddPortfolioPositionInput,
  result: Record<string, unknown>,
): PortfolioPosition {
  return {
    id: stringField(result, "id") ?? `${input.portfolioId}:${input.symbol}`,
    symbol: input.symbol,
    name: stringField(result, "name") ?? input.symbol,
    value: input.quantity * input.averageCost,
    allocation: `${input.quantity}`,
    thesis: input.thesis ?? "",
  };
}

function stringField(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = record[field];
  return typeof value === "string" ? value : undefined;
}

function commandErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Command failed";
}
