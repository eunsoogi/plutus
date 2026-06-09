import { remoteStateLabel, type RemoteVisualState } from "./core";
import { useI18n } from "./i18n";
import { localizedScenarioText } from "./plutus-command";
import { MobileShell } from "./plutus-shell";
import type { PlutusScenario } from "./plutus-types";

export function PairPage({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.pair")}</h1>
      <section className="panel">
        <p>{t("remote.pairBody")}</p>
        <div className="pair-code">
          {localizedScenarioText(scenario.remoteDevice.pairingCode, t)}
        </div>
      </section>
    </MobileShell>
  );
}

export function RemoteStateBanner({ remote }: { remote: RemoteVisualState }) {
  const { locale } = useI18n();
  const label = remoteStateLabel(remote, locale);
  return (
    <>
      <section className={`remote-state ${remote}`} data-testid="remote-state">
        {label}
      </section>
      <span data-testid="connection-state">{label}</span>
    </>
  );
}

export function ConnectionPage({ remote }: { remote: RemoteVisualState }) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.connection")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{t("remote.hostIdentity")}</p>
        <p>{t("remote.heartbeat")}</p>
      </section>
    </MobileShell>
  );
}
