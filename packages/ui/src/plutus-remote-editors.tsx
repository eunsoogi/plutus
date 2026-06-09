import { useEffect, useState } from "react";

import type { RemoteVisualState } from "./core";
import { useI18n } from "./i18n";
import { PortfolioSummary } from "./plutus-dashboard";
import {
  buildRemoteCommand,
  commandErrorMessage,
  localizedScenarioText,
  remoteCommandCredentials,
} from "./plutus-command";
import { MobileShell } from "./plutus-shell";
import type { PlutusCommandClient, PlutusScenario } from "./plutus-types";
import { RemoteStateBanner } from "./plutus-remote-core";
import { WatchlistPanel } from "./plutus-watchlists";

export function RemotePortfolioPage({
  scenario,
  remote,
  commandClient,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<string | null>(null);
  const firstPosition = scenario.portfolio.positions[0];
  const [thesis, setThesis] = useState(firstPosition?.thesis ?? "");
  useEffect(() => {
    setThesis(firstPosition?.thesis ?? "");
  }, [firstPosition?.id, firstPosition?.thesis]);
  const disabled =
    remote !== "connected" ||
    !firstPosition?.id ||
    (!scenario.remoteDevice.unlockProof &&
      !commandClient?.remote?.prepareUnlock) ||
    !commandClient?.remote?.executeCommand;
  const thesisLabel = firstPosition
    ? t("portfolio.symbolThesis", { symbol: firstPosition.symbol })
    : t("portfolio.positionThesis");

  async function saveThesis() {
    if (!firstPosition?.id || !commandClient?.remote?.executeCommand) {
      setStatus(t("portfolio.noEditable"));
      return;
    }
    const commandId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const payload = {
        positionId: firstPosition.id,
        thesis,
      };
      const credentials = await remoteCommandCredentials(
        commandClient,
        scenario,
        commandId,
        "portfolio.updatePositionThesis",
        payload,
      );
      if (!credentials) {
        setStatus(t("remote.unlockRequired"));
        return;
      }
      await commandClient.remote.executeCommand(
        buildRemoteCommand({
          commandId,
          commandType: "portfolio.updatePositionThesis",
          sessionId: credentials.sessionId,
          sessionKeyRef: credentials.sessionKeyRef,
          unlockProof: credentials.unlockProof,
          payload,
        }),
      );
      setStatus(t("remote.savedThesis"));
    } catch (error) {
      setStatus(commandErrorMessage(error));
    }
  }

  return (
    <MobileShell>
      <h1>{t("remote.portfolio")}</h1>
      <RemoteStateBanner remote={remote} />
      <PortfolioSummary scenario={scenario} />
      <section className="panel">
        <h2>{t("remote.thesisEdit")}</h2>
        <label className="field-row">
          {thesisLabel}
          <textarea
            aria-label={thesisLabel}
            value={thesis}
            onChange={(event) => setThesis(event.currentTarget.value)}
            disabled={disabled}
          />
        </label>
        <button className="secondary" disabled={disabled} onClick={saveThesis}>
          {t("remote.saveThesis")}
        </button>
        {status ? <p data-testid="remote-edit-status">{status}</p> : null}
      </section>
    </MobileShell>
  );
}

export function RemoteWatchlistPage({
  scenario,
  remote,
  commandClient,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const firstItem = scenario.watchlist.items[0];
  const [note, setNote] = useState(firstItem?.triggerNote ?? "");
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    setNote(firstItem?.triggerNote ?? "");
  }, [firstItem?.id, firstItem?.triggerNote]);
  const disabled =
    remote !== "connected" ||
    !firstItem?.id ||
    (!scenario.remoteDevice.unlockProof &&
      !commandClient?.remote?.prepareUnlock) ||
    !commandClient?.remote?.executeCommand;
  const noteLabel = firstItem
    ? t("watchlist.symbolNote", { symbol: firstItem.symbol })
    : t("watchlist.itemNote");
  async function saveNote() {
    if (!firstItem?.id || !commandClient?.remote?.executeCommand) {
      setStatus(t("watchlist.noEditable"));
      return;
    }
    const commandId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const payload = {
        itemId: firstItem.id,
        triggerNote: note,
      };
      const credentials = await remoteCommandCredentials(
        commandClient,
        scenario,
        commandId,
        "watchlist.updateItem",
        payload,
      );
      if (!credentials) {
        setStatus(t("remote.unlockRequired"));
        return;
      }
      await commandClient.remote.executeCommand(
        buildRemoteCommand({
          commandId,
          commandType: "watchlist.updateItem",
          sessionId: credentials.sessionId,
          sessionKeyRef: credentials.sessionKeyRef,
          unlockProof: credentials.unlockProof,
          payload,
        }),
      );
      setStatus(t("remote.savedWatchlist"));
    } catch (error) {
      setStatus(commandErrorMessage(error));
    }
  }
  return (
    <MobileShell>
      <h1>{t("remote.watchlist")}</h1>
      <RemoteStateBanner remote={remote} />
      <WatchlistPanel
        scenario={scenario}
        title={localizedScenarioText(scenario.watchlist.name, t)}
      />
      <section className="panel">
        <h2>{t("remote.noteEdit")}</h2>
        <label className="field-row">
          {noteLabel}
          <textarea
            aria-label={noteLabel}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            disabled={disabled}
          />
        </label>
        <button className="secondary" disabled={disabled} onClick={saveNote}>
          {t("remote.saveWatchlist")}
        </button>
        {status ? <p data-testid="remote-watchlist-status">{status}</p> : null}
      </section>
    </MobileShell>
  );
}
