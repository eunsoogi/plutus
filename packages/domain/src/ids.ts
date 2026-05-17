import { z } from "zod";

export const UuidSchema = z.string().uuid();
export const IsoUtcDateTimeSchema = z.string().datetime({ offset: true });

export type Uuid = z.infer<typeof UuidSchema>;
export type IsoUtcDateTime = z.infer<typeof IsoUtcDateTimeSchema>;
