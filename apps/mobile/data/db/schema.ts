import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// JSON payloads retain the public entity format, while indexed keys and tombstones
// let the sync engine merge individual records rather than replace collections.
export const records = sqliteTable("records", {
  kind: text("kind", { enum: ["categories", "expenses"] }).notNull(),
  id: text("id").notNull(),
  payload: text("payload").notNull(),
  deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
}, (table) => [primaryKey({ columns: [table.kind, table.id] })]);
export const outbox = sqliteTable("outbox", {
  operationId: text("operation_id").primaryKey(),
  kind: text("kind", { enum: ["categories", "expenses"] }).notNull(),
  id: text("id").notNull(),
  payload: text("payload").notNull(),
  deleted: integer("deleted", { mode: "boolean" }).notNull(),
  sequence: integer("sequence").notNull(),
}, (table) => [
  index("outbox_sequence").on(table.sequence),
  index("outbox_record").on(table.kind, table.id),
]);
export const metadata = sqliteTable("metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
