import type { PlutusScenario } from "@plutus/ui";

export const emptyAppScenario: PlutusScenario = {
  profileId: "",
  portfolio: {
    id: "",
    name: "No portfolio yet",
    value: 0,
    positions: [],
  },
  watchlist: {
    id: "",
    name: "No watchlist yet",
    items: [],
  },
  instrument: {
    id: "",
    symbol: "",
    name: "No instrument selected",
    summary: "Create a portfolio or watchlist to inspect instruments.",
  },
  run: {
    id: "",
    title: "No research runs yet",
    status: "No runs yet",
    category: "",
    artifacts: [],
  },
  memory: {
    id: "",
    summary: "",
    activity: "No activity",
  },
  wiki: {
    id: "",
    title: "",
    revision: "",
    sourceRef: "",
  },
  remoteDevice: {
    name: "No paired device",
    pairingCode: "Not paired",
    sessionId: undefined,
    sessionKeyRef: undefined,
    unlockProof: undefined,
  },
};
