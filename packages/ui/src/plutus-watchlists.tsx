import { useI18n } from "./i18n";
import { localizedScenarioText } from "./plutus-command";
import { RiskChart } from "./plutus-dashboard";
import { HostShell } from "./plutus-shell";
import type { PlutusScenario } from "./plutus-types";

export function WatchlistsPage({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{t("watchlist.title")}</h1>
      <WatchlistPanel
        scenario={scenario}
        title={localizedScenarioText(scenario.watchlist.name, t)}
      />
    </HostShell>
  );
}

export function WatchlistDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{localizedScenarioText(scenario.watchlist.name, t)}</h1>
      <WatchlistPanel scenario={scenario} title={t("watchlist.notes")} />
      <section className="panel">
        <h2>{t("watchlist.editableNotes")}</h2>
        <p>{t("watchlist.noteExample")}</p>
      </section>
    </HostShell>
  );
}

export function WatchlistPanel({
  scenario,
  title,
}: {
  scenario: PlutusScenario;
  title: string;
}) {
  return (
    <article className="panel" data-testid="watchlist-default">
      <h2>{title}</h2>
      <div className="pill-row">
        {scenario.watchlist.items.map((item) => (
          <span className="pill" key={item.id ?? item.symbol}>
            {item.symbol}
          </span>
        ))}
      </div>
    </article>
  );
}

export function InstrumentDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  const { t } = useI18n();
  const instrumentName = localizedScenarioText(scenario.instrument.name, t);
  return (
    <HostShell>
      <h1>{scenario.instrument.symbol || t("instrument.empty")}</h1>
      <section className="panel">
        <h2>{scenario.instrument.symbol || instrumentName}</h2>
        <p>{localizedScenarioText(scenario.instrument.summary, t)}</p>
        <RiskChart />
      </section>
    </HostShell>
  );
}
