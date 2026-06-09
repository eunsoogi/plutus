import type { RemoteVisualState } from "@plutus/ui";

export type RouteContext = {
  readonly path: string;
  readonly remote: RemoteVisualState;
};

export function routeContextFromLocation(
  location: Pick<Location, "href">,
): RouteContext {
  const url = new URL(location.href);
  const hashRoute = routeUrlFromHash(url.hash);
  const routeSearch = hashRoute?.searchParams ?? url.searchParams;
  return {
    path: normalizedPathname(hashRoute?.pathname ?? url.pathname),
    remote: remoteVisualStateFromValue(
      routeSearch.get("remote") ??
        routeSearch.get("state") ??
        url.searchParams.get("remote") ??
        url.searchParams.get("state"),
    ),
  };
}

function routeUrlFromHash(hash: string): URL | undefined {
  if (!hash.startsWith("#/")) return undefined;
  return new URL(hash.slice(1), "https://plutus.local");
}

function normalizedPathname(pathname: string): string {
  return pathname === "" ? "/" : pathname;
}

function remoteVisualStateFromValue(value: string | null): RemoteVisualState {
  switch (value) {
    case "connected":
    case "stale":
    case "revoked":
    case "disconnected":
      return value;
    default:
      return "connected";
  }
}
