import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const remote = sqliteTable("remote_records", {
  kind: text("kind", { enum: ["categories", "expenses"] }).notNull(), id: text("id").notNull(), payload: text("payload").notNull(),
  deleted: integer("deleted", { mode: "boolean" }).notNull(), revision: integer("revision").notNull(),
}, (t) => [primaryKey({ columns: [t.kind, t.id] })]);
export const receipts = sqliteTable("receipts", { operationId: text("operation_id").primaryKey(), body: text("body").notNull() });

