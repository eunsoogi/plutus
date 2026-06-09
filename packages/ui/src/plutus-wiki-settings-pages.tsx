import { useState } from "react";

import { useI18n } from "./i18n";
import {
  commandErrorMessage,
  localizedCommandStatus,
  localizedScenarioText,
} from "./plutus-command";
import { HostShell } from "./plutus-shell";
import type { PlutusCommandClient, PlutusScenario } from "./plutus-types";

export function WikiPage({
  scenario,
  detail,
  commandClient,
}: {
  scenario: PlutusScenario;
  detail: boolean;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const [commandStatus, setCommandStatus] = useState("Ready");
  async function revertRevision() {
    if (!commandClient?.wiki) {
      setCommandStatus("No command bridge connected");
      return;
    }
    try {
      await commandClient.wiki.revertRevision(
        scenario.wiki.id,
        scenario.wiki.revision,
        t("wiki.revertReason"),
      );
      setCommandStatus("Command bridge: wiki.revertRevision");
    } catch (error) {
      setCommandStatus(commandErrorMessage(error));
    }
  }
  const hasWikiPage = Boolean(scenario.wiki.id || scenario.wiki.title);
  const hasRevision = Boolean(scenario.wiki.revision);
  const hasSourceRef = Boolean(scenario.wiki.sourceRef);
  return (
    <HostShell>
      <h1>
        {detail ? scenario.wiki.title || t("wiki.page") : t("wiki.browser")}
      </h1>
      <section className="grid two">
        <article className="panel">
          <h2>{t("wiki.feed")}</h2>
          <p>{hasWikiPage ? t("wiki.feedBody") : t("wiki.empty")}</p>
        </article>
        <article className="panel" data-testid="wiki-revision-timeline">
          <h2>{t("wiki.revisionTimeline")}</h2>
          <p>
            {hasRevision
              ? t("wiki.revision", { revision: scenario.wiki.revision })
              : t("common.notAvailable")}
          </p>
          {hasRevision ? <p>audit: {scenario.wiki.revision}</p> : null}
          <p data-testid="wiki-command-status">
            {localizedCommandStatus(commandStatus, t)}
          </p>
          <button
            className="secondary"
            disabled={!hasRevision}
            onClick={() => void revertRevision()}
          >
            {t("wiki.revert")}
          </button>
        </article>
        <article className="panel" data-testid="source-link-drawer">
          <h2>{t("wiki.sourceLinks")}</h2>
          <p>{hasSourceRef ? scenario.wiki.sourceRef : t("wiki.empty")}</p>
        </article>
        <article className="panel" data-testid="wiki-diff-view">
          <h2>{t("wiki.diff")}</h2>
          <p>
            {hasRevision && scenario.wiki.diffBody
              ? scenario.wiki.diffBody
              : t("common.notAvailable")}
          </p>
        </article>
      </section>
    </HostShell>
  );
}

export function SettingsPage({ title }: { title: string }) {
  const { t } = useI18n();
  const localizedTitle = localizedScenarioText(title, t);
  return (
    <HostShell>
      <h1>{localizedTitle}</h1>
      <section className="panel">
        <p>{t("settings.preview")}</p>
      </section>
    </HostShell>
  );
}

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{t("notFound.title")}</h1>
      <section className="panel" data-testid="not-found">
        <p>{t("notFound.body")}</p>
      </section>
    </HostShell>
  );
}

export function RemoteControlSettingsPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  const { t } = useI18n();
  const hasPairedDevice = Boolean(scenario.remoteDevice.sessionId);
  return (
    <HostShell>
      <h1>{t("remote.control")}</h1>
      <section className="panel">
        <div className="row">
          <span>{t("remote.status")}</span>
          <strong>
            {hasPairedDevice ? t("remote.enabled") : t("remote.notPaired")}
          </strong>
        </div>
        <div className="row">
          <span>{t("remote.pairingCode")}</span>
          <strong data-testid="pairing-code">
            {localizedScenarioText(scenario.remoteDevice.pairingCode, t)}
          </strong>
        </div>
        <div className="row">
          <span>{t("remote.connectedDevice")}</span>
          <strong>
            {localizedScenarioText(scenario.remoteDevice.name, t)}
          </strong>
        </div>
        {hasPairedDevice ? (
          <button className="secondary">
            {t("remote.revoke", {
              device: localizedScenarioText(scenario.remoteDevice.name, t),
            })}
          </button>
        ) : (
          <p>{t("remote.noDeviceAction")}</p>
        )}
      </section>
    </HostShell>
  );
}
