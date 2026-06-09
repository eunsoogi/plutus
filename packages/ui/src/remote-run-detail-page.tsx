import { useState } from "react";
import type { RemoteVisualState } from "./core";
import { useI18n } from "./i18n";
import {
  MobileShell,
  RemoteStateBanner,
  RunStageList,
  type PlutusCommandClient,
  type PlutusScenario,
} from "./plutus-app";

type RemoteCredentials = {
  readonly sessionId: string;
  readonly sessionKeyRef: string;
  readonly unlockProof: {
    readonly method: string;
    readonly sessionKeyRef: string;
    readonly challenge?: string;
  };
};

function newRemoteCommandId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function commandErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Command failed";
}

function localizedRunStatus(
  status: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!status || status === "No runs yet") return t("runs.noRunsYet");
  if (status === "completed") return t("runs.completed");
  return status;
}

async function getRemoteCredentials(input: {
  readonly commandClient: PlutusCommandClient;
  readonly scenario: PlutusScenario;
  readonly commandId: string;
  readonly payload: Record<string, unknown>;
}): Promise<RemoteCredentials | null> {
  if (input.commandClient.remote?.prepareUnlock) {
    return await input.commandClient.remote.prepareUnlock({
      commandId: input.commandId,
      commandType: "run.cancel",
      payload: input.payload,
    });
  }
  const { sessionId, sessionKeyRef, unlockProof } = input.scenario.remoteDevice;
  if (sessionId && sessionKeyRef && unlockProof) {
    return { sessionId, sessionKeyRef, unlockProof };
  }
  return null;
}

function buildRunCancelCommand(input: {
  readonly commandId: string;
  readonly credentials: RemoteCredentials;
  readonly payload: Record<string, unknown>;
}) {
  return {
    commandId: input.commandId,
    sessionId: input.credentials.sessionId,
    sessionKeyRef: input.credentials.sessionKeyRef,
    commandType: "run.cancel",
    payload: input.payload,
    unlock: input.credentials.unlockProof,
  };
}

export function RemoteRunDetailPage({
  scenario,
  remote,
  commandClient,
}: {
  readonly scenario: PlutusScenario;
  readonly remote: RemoteVisualState;
  readonly commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const runId = scenario.run.id;
  const disabled =
    pending ||
    remote !== "connected" ||
    !runId ||
    !commandClient?.remote?.executeCommand ||
    (!scenario.remoteDevice.unlockProof && !commandClient.remote.prepareUnlock);

  async function cancelRun() {
    setStatus(null);
    if (!runId || !commandClient?.remote?.executeCommand) {
      setStatus(t("remote.noBridge"));
      return;
    }
    const payload = { runId };
    const commandId = newRemoteCommandId();
    setPending(true);
    try {
      const credentials = await getRemoteCredentials({
        commandClient,
        scenario,
        commandId,
        payload,
      });
      if (!credentials) {
        setStatus(t("remote.unlockRequired"));
        return;
      }
      await commandClient.remote.executeCommand(
        buildRunCancelCommand({ commandId, credentials, payload }),
      );
      setStatus(t("remote.commandBridge"));
    } catch (error) {
      setStatus(commandErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <MobileShell>
      <h1>{t("remote.runDetail")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{localizedRunStatus(scenario.run.status, t)}</p>
        <RunStageList />
        <button className="secondary" disabled={disabled} onClick={cancelRun}>
          {t("remote.cancelRun")}
        </button>
        {status ? <p data-testid="remote-run-cancel-status">{status}</p> : null}
      </section>
    </MobileShell>
  );
}
