export function redactCommandLog<T>(value: T): T {
  if (Array.isArray(value))
    return value.map((item) => redactCommandLog(item)) as T;
  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = /apiKey|authorization|token|secret|sessionKey/i.test(key)
        ? "[REDACTED]"
        : redactCommandLog(nested);
    }
    return redacted as T;
  }
  return value;
}
