import {
  localToolRunContextSchema,
  type LocalToolRunContext,
} from "@plutus/local-tools";

export function decodeSignedRunContext(
  signedRunContext: string,
): LocalToolRunContext | undefined {
  try {
    const json = decodeBase64Url(signedRunContext);
    return localToolRunContextSchema.parse(JSON.parse(json));
  } catch {
    return undefined;
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Array.from(binary, (char) =>
    String.fromCharCode(char.charCodeAt(0)),
  ).join("");
}
