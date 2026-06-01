import type { RemoteVisualState } from "@plutus/ui";

export type RouteContext = {
  readonly path: string;
  readonly remote: RemoteVisualState;
};

export function routeContextFromLocation(
  location: Pick<Location, "href">,
): RouteContext {
  const url = new URL(location.href);
  return {
    path: normalizedPathname(url.pathname),
    remote: remoteVisualStateFromValue(
      url.searchParams.get("remote") ?? url.searchParams.get("state"),
    ),
  };
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
