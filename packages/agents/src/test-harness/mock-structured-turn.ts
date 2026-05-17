import { z } from "zod";

export function validateStructuredTurn<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  return schema.parse(value);
}
