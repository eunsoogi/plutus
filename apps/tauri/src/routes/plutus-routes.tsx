import type { ReactElement } from "react";
import type { AppSnapshot } from "@plutus/command-client";
import { I18nProvider } from "@plutus/ui";

import { emptyAppScenario } from "./plutus-empty-scenario";
import { renderPlutusRouteContent } from "./plutus-route-content";
export { hostRoutePaths, mobileRoutePaths } from "./plutus-route-paths";
export type { PlutusRouteContext } from "./plutus-route-types";
export { scenarioFromSnapshot } from "./plutus-snapshot";
import type { PlutusRouteContext } from "./plutus-route-types";

export { emptyAppScenario };

export function renderPlutusRoute({
  path,
  remote,
  scenario,
  commandClient,
  refreshScenario,
}: PlutusRouteContext): ReactElement {
  return (
    <I18nProvider>
      {renderPlutusRouteContent({
        path,
        remote,
        scenario,
        commandClient,
        refreshScenario,
      })}
    </I18nProvider>
  );
}
