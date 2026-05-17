import { NAMESPACE_NAMES } from "@plutus/local-tools";

export function parseMcpToolName(
  name: string,
): { namespace: string; tool: string } | undefined {
  const namespace = NAMESPACE_NAMES.find((candidate) =>
    name.startsWith(`${candidate}.`),
  );
  if (!namespace) {
    return undefined;
  }
  const tool = name.slice(namespace.length + 1);
  if (!tool) {
    return undefined;
  }
  return { namespace, tool };
}
