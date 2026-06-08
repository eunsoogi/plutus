import { createRoot } from "react-dom/client";
import {
  createCommandClient,
  createTauriCommandBridge,
} from "@plutus/command-client";
import { renderPlutusRoute, scenarioFromSnapshot } from "@plutus/tauri";
import { createLocalWebCommandBridge } from "./local-runtime";
import "./provider-settings.css";
import "./provider-settings-list.css";
import "./provider-settings-detail.css";
import "./provider-settings-workbench.css";
import "./provider-settings-responsive.css";
import { routeContextFromLocation } from "./route-context";
import "./styles.css";
import "./orchestrator-office.css";
import "./dashboard-first-screen.css";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    __PLUTUS_COMMAND_BRIDGE__?: Parameters<typeof createCommandClient>[0];
  }
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

function ensureViewportMeta() {
  if (document.querySelector('meta[name="viewport"]')) return;
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content = "width=device-width, initial-scale=1, viewport-fit=cover";
  document.head.append(meta);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Plutus root element was not found.");
}
ensureViewportMeta();
const root = createRoot(rootElement);

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
    const runtimeError =
      error instanceof Error
        ? error
        : new Error("Unknown Plutus runtime error.");
    console.error("Failed to load Plutus runtime", runtimeError);
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
