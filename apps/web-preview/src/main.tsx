import { createRoot } from "react-dom/client";
import { renderPlutusRoute } from "@plutus/tauri";
import type { RemoteVisualState } from "@plutus/ui";
import "./styles.css";

function routeContextFromLocation(location: Location) {
  const url = new URL(location.href);
  return {
    path: url.pathname,
    remote: (url.searchParams.get("remote") ??
      url.searchParams.get("state") ??
      "connected") as RemoteVisualState,
  };
}

createRoot(document.getElementById("root")!).render(
  renderPlutusRoute(routeContextFromLocation(window.location)),
);
