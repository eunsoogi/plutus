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
  interface ImportMeta {
    readonly env: {
      readonly PROD: boolean;
    };
  }

  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    __PLUTUS_COMMAND_BRIDGE__?: Parameters<typeof createCommandClient>[0];
    __PLUTUS_ROUTE_MODE__?: "hash" | "path";
  }
}

async function createRuntimeClient(location: Location) {
  const search = routeSearchParamsFromHref(location.href);
  if (search.get("runtime") === "none") return undefined;
  if (window.__PLUTUS_COMMAND_BRIDGE__) {
    return createCommandClient(window.__PLUTUS_COMMAND_BRIDGE__);
  }
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return createCommandClient(createTauriCommandBridge(invoke));
  }
  if (search.get("runtime") !== "local") return undefined;
  return createCommandClient(createLocalWebCommandBridge());
}

function routeSearchParamsFromHref(href: string): URLSearchParams {
  const url = new URL(href);
  const hashRoute = url.hash.startsWith("#/")
    ? new URL(url.hash.slice(1), "https://plutus.local")
    : null;
  if (!hashRoute) return url.searchParams;
  const routeSearch = new URLSearchParams(url.searchParams);
  for (const [key, value] of hashRoute.searchParams) {
    routeSearch.set(key, value);
  }
  return routeSearch;
}

function ensureViewportMeta() {
  if (document.querySelector('meta[name="viewport"]')) return;
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content = "width=device-width, initial-scale=1, viewport-fit=cover";
  document.head.append(meta);
}

function ensureRouteMode() {
  window.__PLUTUS_ROUTE_MODE__ ??= import.meta.env.PROD ? "hash" : "path";
}

function isTauriRuntime() {
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Plutus root element was not found.");
}
ensureViewportMeta();
ensureRouteMode();
const root = createRoot(rootElement);
let latestRouteRender = 0;

async function renderCurrentRoute() {
  const routeRender = latestRouteRender + 1;
  latestRouteRender = routeRender;
  const routeContext = routeContextFromLocation(window.location);
  let commandClient: Awaited<ReturnType<typeof createRuntimeClient>>;
  let scenario;
  renderRoute(routeContext);
  try {
    commandClient = await createRuntimeClient(window.location);
  } catch (error) {
    const runtimeError =
      error instanceof Error
        ? error
        : new Error("Unknown Plutus runtime error.");
    console.error("Failed to load Plutus runtime", runtimeError);
    commandClient = undefined;
  }

  if (routeRender !== latestRouteRender) return;
  if (commandClient) {
    renderRoute(routeContext, { commandClient });
  }

  try {
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

  if (routeRender !== latestRouteRender) return;
  renderRoute(routeContext, {
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
  });
}

function renderRoute(
  routeContext: ReturnType<typeof routeContextFromLocation>,
  runtime?: Pick<
    Parameters<typeof renderPlutusRoute>[0],
    "commandClient" | "refreshScenario" | "scenario"
  >,
) {
  root.render(
    renderPlutusRoute({
      ...routeContext,
      ...runtime,
    }),
  );
}

function sameDocumentNavigationUrl(event: MouseEvent): URL | undefined {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return undefined;
  }
  if (!(event.target instanceof Element)) return undefined;
  const anchor = event.target.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) return undefined;
  if (anchor.target || anchor.hasAttribute("download")) return undefined;
  const url = new URL(anchor.href, window.location.href);
  const currentUrl = new URL(window.location.href);
  if (url.protocol !== currentUrl.protocol || url.host !== currentUrl.host) {
    return undefined;
  }
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash === window.location.hash
  ) {
    return undefined;
  }
  return url;
}

document.addEventListener("click", (event) => {
  const url = sameDocumentNavigationUrl(event);
  if (!url) return;
  event.preventDefault();
  navigateSameDocument(url);
  void renderCurrentRoute();
});
window.addEventListener("popstate", () => {
  void renderCurrentRoute();
});
window.addEventListener("hashchange", () => {
  void renderCurrentRoute();
});

void renderCurrentRoute();

function sameDocumentNavigationHref(url: URL): string {
  if (usesHashRoutes() && url.pathname !== "/" && !url.hash.startsWith("#/")) {
    return `/#${url.pathname}${url.search}`;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function navigateSameDocument(url: URL) {
  window.history.pushState(null, "", sameDocumentNavigationHref(url));
}

function usesHashRoutes() {
  return window.__PLUTUS_ROUTE_MODE__ === "hash";
}
