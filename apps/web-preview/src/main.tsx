import { createRoot } from "react-dom/client";
import {
  createCommandClient,
  createTauriCommandBridge,
} from "@plutus/command-client";
import { renderPlutusRoute, scenarioFromSnapshot } from "@plutus/tauri";
import type { RemoteVisualState } from "@plutus/ui";
import { createLocalWebCommandBridge } from "./local-runtime";
import "./provider-settings.css";
import "./styles.css";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    __PLUTUS_COMMAND_BRIDGE__?: Parameters<typeof createCommandClient>[0];
  }
}

function routeContextFromLocation(location: Location) {
  const url = new URL(location.href);
  return {
    path: url.pathname,
    remote: (url.searchParams.get("remote") ??
      url.searchParams.get("state") ??
      "connected") as RemoteVisualState,
  };
}

async function createRuntimeClient(location: Location) {
  const url = new URL(location.href);
  if (url.searchParams.get("runtime") === "none") return undefined;
  if (window.__PLUTUS_COMMAND_BRIDGE__) {
    return createCommandClient(window.__PLUTUS_COMMAND_BRIDGE__);
  }
  if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
    const { invoke } = await import("@tauri-apps/api/core");
    return createCommandClient(createTauriCommandBridge(invoke));
  }
  if (url.searchParams.get("runtime") !== "local") return undefined;
  return createCommandClient(createLocalWebCommandBridge());
}

const root = createRoot(document.getElementById("root")!);

void (async () => {
  const routeContext = routeContextFromLocation(window.location);
  let commandClient: Awaited<ReturnType<typeof createRuntimeClient>>;
  let scenario;
  try {
    commandClient = await createRuntimeClient(window.location);
    scenario = commandClient
      ? scenarioFromSnapshot(
          await commandClient.app.getSnapshot(),
          routeContext.path,
        )
      : undefined;
  } catch (error) {
    console.error("Failed to load Plutus runtime", error);
    commandClient = undefined;
    scenario = undefined;
  }

  root.render(
    renderPlutusRoute({
      ...routeContext,
      commandClient,
      scenario,
      refreshScenario:
        commandClient &&
        (() =>
          commandClient.app
            .getSnapshot()
            .then((snapshot) =>
              scenarioFromSnapshot(snapshot, routeContext.path),
            )),
    }),
  );
})();
