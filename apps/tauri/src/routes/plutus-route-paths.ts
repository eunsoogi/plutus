import { artifactRoute, oneSegmentRoute } from "./plutus-route-matchers";

export const hostRoutePaths = [
  "/dashboard",
  "/office",
  "/portfolios",
  "/portfolios/:portfolioId",
  "/watchlists",
  "/watchlists/:watchlistId",
  "/instruments/:instrumentId",
  "/runs",
  "/runs/:runId",
  "/runs/:runId/artifacts/:artifactId",
  "/strategies",
  "/memory",
  "/wiki",
  "/wiki/:pageId",
  "/settings/security",
  "/settings/providers",
  "/settings/preferences",
  "/settings/remote-control",
  "/settings/import-export",
] as const;

export const mobileRoutePaths = [
  "/pair",
  "/connection",
  "/remote/dashboard",
  "/remote/portfolios/:portfolioId",
  "/remote/watchlists/:watchlistId",
  "/remote/instruments/:instrumentId",
  "/remote/runs",
  "/remote/runs/:runId",
  "/remote/artifacts/:artifactId",
  "/remote/memory",
  "/remote/wiki",
  "/remote/wiki/:pageId",
  "/remote/settings",
] as const;

export function isKnownHostRoute(path: string): boolean {
  return (
    path === "/" ||
    path === "/dashboard" ||
    path === "/office" ||
    path === "/portfolios" ||
    oneSegmentRoute(path, "portfolios") ||
    path === "/watchlists" ||
    oneSegmentRoute(path, "watchlists") ||
    oneSegmentRoute(path, "instruments") ||
    path === "/runs" ||
    oneSegmentRoute(path, "runs") ||
    artifactRoute(path) ||
    path === "/strategies" ||
    path === "/memory" ||
    path === "/wiki" ||
    oneSegmentRoute(path, "wiki") ||
    path === "/settings/security" ||
    path === "/settings/providers" ||
    path === "/settings/preferences" ||
    path === "/settings/remote-control" ||
    path === "/settings/import-export"
  );
}
