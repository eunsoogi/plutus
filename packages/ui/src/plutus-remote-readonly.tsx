import type { RemoteVisualState } from "./core";
import { useI18n } from "./i18n";
import { RiskChart, RiskWarning } from "./plutus-dashboard";
import { localizedScenarioText } from "./plutus-command";
import { MobileShell } from "./plutus-shell";
import type { PlutusScenario } from "./plutus-types";
import { RemoteStateBanner } from "./plutus-remote-core";

export function RemoteInstrumentPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  const { t } = useI18n();
  const instrumentName = localizedScenarioText(scenario.instrument.name, t);
  return (
    <MobileShell>
      <h1>{t("remote.instrument")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <h2>{scenario.instrument.symbol || instrumentName}</h2>
        <p>{localizedScenarioText(scenario.instrument.summary, t)}</p>
        <RiskChart />
      </section>
    </MobileShell>
  );
}

export function RemoteRunsPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.runs")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{localizedScenarioText(scenario.run.title, t)}</p>
        <RiskWarning />
      </section>
    </MobileShell>
  );
}

export function RemoteArtifactPage({ remote }: { remote: RemoteVisualState }) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.artifact")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <RiskChart />
        <p>{t("remote.artifactSummary")}</p>
      </section>
    </MobileShell>
  );
}

export function RemoteMemoryPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.memory")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel" data-testid="memory-activity-feed">
        <p>{scenario.memory.summary}</p>
        <p>{t("remote.readOnlyMobile")}</p>
      </section>
    </MobileShell>
  );
}

export function RemoteWikiPage({
  scenario,
  remote,
  detail,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  detail: boolean;
}) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{detail ? t("remote.wikiPage") : t("remote.wiki")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <h2>{scenario.wiki.title}</h2>
        <p>{t("remote.readOnlyWiki")}</p>
      </section>
    </MobileShell>
  );
}

export function RemoteSettingsPage({ remote }: { remote: RemoteVisualState }) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.settings")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{t("remote.biometricRequired")}</p>
      </section>
    </MobileShell>
  );
}
