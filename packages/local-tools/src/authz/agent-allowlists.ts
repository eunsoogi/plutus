export type { AgentAllowlist } from "./agent-tools";
export { NAMESPACE_NAMES, WRITE_TOOLS } from "./agent-tools";
import type { AgentAllowlist } from "./agent-tools";
import { MANAGEMENT_AGENT_ALLOWLISTS } from "./agent-allowlists-management";
import { RESEARCH_AGENT_ALLOWLISTS } from "./agent-allowlists-research";

export const AGENT_ALLOWLISTS: Record<string, AgentAllowlist> = {
  ...RESEARCH_AGENT_ALLOWLISTS,
  ...MANAGEMENT_AGENT_ALLOWLISTS,
};
