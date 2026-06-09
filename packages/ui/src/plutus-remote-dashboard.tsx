import { useState } from "react";

import type { RemoteVisualState } from "./core";
import { useI18n } from "./i18n";
import {
  buildRemoteCommand,
  commandErrorMessage,
  localizedCommandSource,
  localizedScenarioText,
  remoteCommandCredentials,
} from "./plutus-command";
import { MobileShell } from "./plutus-shell";
import type { PlutusCommandClient, PlutusScenario } from "./plutus-types";
import { RemoteStateBanner } from "./plutus-remote-core";

export function RemoteDashboardPage({
  scenario,
  remote,
  commandClient,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const disabled =
    remote !== "connected" ||
    !scenario.portfolio.id ||
    (!scenario.remoteDevice.unlockProof &&
      !commandClient?.remote?.prepareUnlock) ||
    !commandClient?.remote?.executeCommand;
  const [pending, setPending] = useState(false);
  const [commandSource, setCommandSource] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  async function startRemoteReview() {
    setCommandError(null);
    if (!commandClient?.remote?.executeCommand) {
      setCommandSource(t("remote.noBridge"));
      return;
    }
    if (!scenario.portfolio.id) {
      setCommandError(t("runs.createFirst"));
      return;
    }
    const commandId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending(true);
    try {
      const payload = {
        portfolioId: scenario.portfolio.id,
        symbols: scenario.portfolio.positions.map(
          (position) => position.symbol,
        ),
        selectedTeam: "portfolio_review_committee",
        userRequest: `Start remote review for ${scenario.portfolio.name}`,
      };
      const credentials = await remoteCommandCredentials(
        commandClient,
        scenario,
        commandId,
        "run.start",
        payload,
      );
      if (!credentials) {
        setCommandError(t("remote.unlockRequired"));
        return;
      }
      await commandClient.remote.executeCommand(
        buildRemoteCommand({
          commandId,
          commandType: "run.start",
          sessionId: credentials.sessionId,
          sessionKeyRef: credentials.sessionKeyRef,
          unlockProof: credentials.unlockProof,
          payload,
        }),
      );
      setCommandSource("Command bridge");
    } catch (error) {
      setCommandError(commandErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <MobileShell>
      <h1>{t("remote.dashboard")}</h1>
      <RemoteStateBanner remote={remote} />
      {remote === "revoked" ? (
        <section className="risk-warning" data-testid="remote-command-error">
          {t("remote.revoked")}
        </section>
      ) : null}
      <article className="panel" data-testid="portfolio-core">
        <p>{t("remote.controller")}</p>
        <p>
          {localizedScenarioText(scenario.portfolio.name, t)}:{" "}
          {scenario.portfolio.positions
            .map((position) => position.symbol)
            .join(", ") || t("remote.noPositions")}
        </p>
        <button
          className="primary"
          data-testid="remote-command"
          aria-label={t("remote.startAccessible")}
          disabled={disabled || pending}
          onClick={startRemoteReview}
        >
          {pending
            ? t("remote.starting")
            : remote === "revoked"
              ? t("remote.denied")
              : t("remote.start")}
        </button>
        {commandSource ? (
          <p data-testid="remote-command-status">
            {localizedCommandSource(commandSource, t)}
          </p>
        ) : null}
        {commandError ? (
          <p data-testid="remote-command-status">{commandError}</p>
        ) : null}
      </article>
    </MobileShell>
  );
}
