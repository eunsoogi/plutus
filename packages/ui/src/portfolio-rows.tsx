import { formatCurrency } from "./core";
import { useI18n } from "./i18n";
import {
  HostShell,
  localizedScenarioText,
  type PlutusScenario,
} from "./plutus-app";

export function PortfolioDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{localizedScenarioText(scenario.portfolio.name, t)}</h1>
      <PortfolioRows scenario={scenario} />
      <section className="panel">
        <h2>{t("portfolio.thesisNotes")}</h2>
        {scenario.portfolio.positions.map((position) => (
          <p key={position.symbol}>
            <strong>{position.symbol}</strong>: {position.thesis}
          </p>
        ))}
      </section>
    </HostShell>
  );
}

export function PortfolioRows({ scenario }: { scenario: PlutusScenario }) {
  const { locale, t } = useI18n();
  return (
    <article className="panel" data-testid="portfolio-core">
      <h2>{localizedScenarioText(scenario.portfolio.name, t)}</h2>
      {scenario.portfolio.positions.length ? (
        scenario.portfolio.positions.map((position) => (
          <div className="row" key={position.id ?? position.symbol}>
            <span>
              {position.symbol} - {position.name}
            </span>
            <strong>{formatCurrency(position.value, "USD", locale)}</strong>
          </div>
        ))
      ) : (
        <div className="row">
          <span>{t("remote.noPositions")}</span>
          <strong>{formatCurrency(0, "USD", locale)}</strong>
        </div>
      )}
    </article>
  );
}
