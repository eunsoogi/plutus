import type {
  PlutusCommandClient,
  PlutusScenario,
  RemoteVisualState,
} from "@plutus/ui";

export type PlutusRouteContext = {
  path: string;
  remote: RemoteVisualState;
  scenario?: PlutusScenario;
  commandClient?: PlutusCommandClient;
  refreshScenario?: () => Promise<PlutusScenario>;
};
