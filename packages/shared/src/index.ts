import { z } from "zod";

const id = z.string().min(1).max(200);
export const categorySchema = z.object({ id, name: z.string().min(1).max(500), color: z.string().min(1).max(100) });
export const expenseSchema = z.object({
  id, amount: z.number().positive().finite(), date: z.string().min(1).max(100), categoryId: id,
  currency: z.string().max(10).optional(), sourcePaymentId: id.optional(),
});
export const kindSchema = z.enum(["categories", "expenses"]);
export type Kind = z.infer<typeof kindSchema>;
export type Entity = z.infer<typeof categorySchema> | z.infer<typeof expenseSchema>;
export const changeSchema = z.object({ kind: kindSchema, id, payload: z.string().max(10000), deleted: z.boolean() }).superRefine((value, ctx) => {
  try {
    const parsed = (value.kind === "categories" ? categorySchema : expenseSchema).parse(JSON.parse(value.payload));
    if (parsed.id !== value.id) throw new Error("ID mismatch");
  } catch { ctx.addIssue({ code: "custom", message: "Invalid entity payload" }); }
});
export const operationSchema = changeSchema.safeExtend({ operationId: id });
export const requestSchema = z.object({ cursor: z.number().int().nonnegative(), operations: z.array(operationSchema).max(100) });
export const responseSchema = z.object({
  cursor: z.number().int().nonnegative(), acknowledged: z.array(id).max(100),
  changes: z.array(changeSchema).max(500), hasMore: z.boolean(),
});
export type Change = z.infer<typeof changeSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type SyncResponse = z.infer<typeof responseSchema>;
export function parseEntities(kind: Kind, value: unknown): Entity[] {
  return (kind === "categories" ? z.array(categorySchema) : z.array(expenseSchema)).parse(value);
}
export function parseCollection(kind: Kind, raw: string): Entity[] {
  const value = JSON.parse(raw);
  // Both historical formats are migrated, without deleting malformed source data.
  return parseEntities(kind, Array.isArray(value) ? value : value.data);
}
