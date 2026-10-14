import { categorySchema, expenseSchema } from "@fin/shared";
import { z } from "zod";

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const backupSchema = z.object({
  format: z.literal("fin-backup"),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  categories: z.array(categorySchema),
  expenses: z.array(expenseSchema),
});
export type Backup = z.infer<typeof backupSchema>;

export function validateBackup(value: unknown): Backup {
  const result = backupSchema.safeParse(value);
  if (!result.success) throw new Error("Choose a valid Fin JSON backup (version 1).");
  for (const kind of ["categories", "expenses"] as const) {
    if (new Set(result.data[kind].map((entity) => entity.id)).size !== result.data[kind].length) {
      throw new Error(`The backup contains duplicate ${kind} IDs.`);
    }
  }
  return result.data;
}

export function parseBackup(raw: string): Backup {
  let bytes = 0;
  for (const character of raw) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > MAX_BACKUP_BYTES) throw new Error("Backups must be smaller than 20 MB.");
  }
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^\uFEFF/, "")); }
  catch { throw new Error("This file is not valid JSON. Choose a Fin backup."); }
  return validateBackup(value);
}

export function serializeBackup(categories: Backup["categories"], expenses: Backup["expenses"]): string {
  return JSON.stringify(validateBackup({ format: "fin-backup", version: 1, exportedAt: new Date().toISOString(), categories, expenses }), null, 2);
}

export function backupFilename() {
  return `fin-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}
