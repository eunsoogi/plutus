import { z } from "zod";

export function zodToJsonSchemaShape(
  schema: z.ZodType<unknown>,
): Record<string, unknown> {
  if (schema instanceof z.ZodDefault) {
    return zodToJsonSchemaShape(schema.removeDefault());
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const required = Object.entries(shape)
      .filter(
        ([, value]) =>
          !(value instanceof z.ZodOptional || value instanceof z.ZodDefault),
      )
      .map(([key]) => key);
    return {
      type: "object",
      additionalProperties: false,
      ...(required.length > 0 ? { required } : {}),
      properties: Object.fromEntries(
        Object.entries(shape).map(([key, value]) => [
          key,
          zodToJsonSchemaShape(value as z.ZodType<unknown>),
        ]),
      ),
    };
  }
  if (schema instanceof z.ZodLiteral) {
    const value = schema.value;
    return { const: value, type: typeof value };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options };
  }
  if (schema instanceof z.ZodString) {
    return { type: "string" };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: "number" };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchemaShape(schema.element) };
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return zodToJsonSchemaShape(schema.unwrap());
  }
  return {
    type: "object",
    description:
      "Structured Plutus response validated again by the product adapter.",
  };
}
