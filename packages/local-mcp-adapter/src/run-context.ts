import { createHmac, timingSafeEqual } from "node:crypto";
import {
  localToolRunContextSchema,
  type LocalToolRunContext,
} from "@plutus/local-tools";

export interface SignedRunContextOptions {
  secret?: string;
  namespace: string;
  now?: Date;
}

export interface SignRunContextOptions {
  secret: string;
  namespace: string;
  expiresAt: Date;
}

export function decodeSignedRunContext(
  signedRunContext: string,
  options: SignedRunContextOptions,
): LocalToolRunContext | undefined {
  if (!options.secret) {
    return undefined;
  }
  try {
    const [payload, signature] = signedRunContext.split(".");
    if (!payload || !signature) {
      return undefined;
    }
    if (!verifySignature(payload, signature, options.secret)) {
      return undefined;
    }
    const envelope = JSON.parse(decodeBase64Url(payload));
    if (
      !envelope ||
      typeof envelope !== "object" ||
      envelope.namespace !== options.namespace ||
      typeof envelope.exp !== "number"
    ) {
      return undefined;
    }
    if ((options.now ?? new Date()).getTime() >= envelope.exp * 1000) {
      return undefined;
    }
    return localToolRunContextSchema.parse(envelope.context);
  } catch {
    return undefined;
  }
}

export function signRunContext(
  context: LocalToolRunContext,
  options: SignRunContextOptions,
): string {
  const payload = encodeBase64Url(
    JSON.stringify({
      context,
      exp: Math.floor(options.expiresAt.getTime() / 1000),
      namespace: options.namespace,
    }),
  );
  const signature = createHmac("sha256", options.secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}
