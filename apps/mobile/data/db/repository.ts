import { and, asc, count, eq } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { metadata, outbox, records } from "./schema";
import { parseEntities, type Entity, type Kind, type SyncResponse } from "../sync/protocol";
import { serializeBackup, validateBackup } from "../backup";

export function createRepository(db: ExpoSQLiteDatabase, newId: () => string) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const where = (kind: Kind, id: string) => and(eq(records.kind, kind), eq(records.id, id));
  const meta = (key: string) => db.select().from(metadata).where(eq(metadata.key, key)).get()?.value;
  const setMeta = (key: string, value: string) => db.insert(metadata).values({ key, value }).onConflictDoUpdate({ target: metadata.key, set: { value } }).run();
  const queue = (kind: Kind, entity: Entity, deleted: boolean) => {
    const row = { kind, id: entity.id, payload: JSON.stringify(entity), deleted };
    db.insert(records).values(row).onConflictDoUpdate({ target: [records.kind, records.id], set: row }).run();
    const sequence = Number(meta("sequence") ?? 0) + 1;
    setMeta("sequence", String(sequence));
    db.insert(outbox).values({ ...row, operationId: newId(), sequence }).run();
  };
  const rows = (kind?: Kind, activeOnly = false) => {
    const result: (typeof records.$inferSelect)[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = db.select().from(records).where(and(kind ? eq(records.kind, kind) : undefined, activeOnly ? eq(records.deleted, false) : undefined)).orderBy(asc(records.kind), asc(records.id)).limit(100).offset(offset).all();
      result.push(...page);
      if (page.length < 100) return result;
    }
  };
  const list = (kind: Kind): Entity[] => rows(kind, true).map((row) => JSON.parse(row.payload));
  return {
    list, meta, setMeta,
    exportBackup() {
      return db.transaction(() => serializeBackup(list("categories") as Parameters<typeof serializeBackup>[0], list("expenses") as Parameters<typeof serializeBackup>[1]));
    },
    importBackup(value: unknown) {
      const backup = validateBackup(value);
      const result = { categories: 0, expenses: 0, skipped: 0 };
      db.transaction(() => {
        const existing = rows();
        const ids = new Set(existing.map((row) => JSON.stringify([row.kind, row.id])));
        const paymentIds = new Set(existing.filter((row) => row.kind === "expenses").map((row) => JSON.parse(row.payload).sourcePaymentId).filter(Boolean));
        for (const kind of ["categories", "expenses"] as const) {
          for (const entity of backup[kind]) {
            const paymentId = "sourcePaymentId" in entity ? entity.sourcePaymentId : undefined;
            // Existing records, including deletions, retain their current state.
            if (ids.has(JSON.stringify([kind, entity.id])) || (paymentId && paymentIds.has(paymentId))) {
              result.skipped++;
              continue;
            }
            queue(kind, entity, false);
            result[kind]++;
            if (paymentId) paymentIds.add(paymentId);
          }
        }
      });
      if (result.categories || result.expenses) notify();
      return result;
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    upsert(kind: Kind, value: Entity) {
      const entity = parseEntities(kind, [value])[0];
      db.transaction(() => {
        // Payment reminders are idempotent on this device, even after a restart.
        if (kind === "expenses" && "sourcePaymentId" in entity && entity.sourcePaymentId && list(kind).some((item) => "sourcePaymentId" in item && item.sourcePaymentId === entity.sourcePaymentId && item.id !== entity.id)) return;
        queue(kind, entity, false);
      });
      notify();
    },
    remove(kind: Kind, id: string) {
      db.transaction(() => {
        const row = db.select().from(records).where(where(kind, id)).get();
        if (row && !row.deleted) queue(kind, JSON.parse(row.payload), true);
      });
      notify();
    },
    replace(kind: Kind, values: Entity[]) {
      const entities = parseEntities(kind, values);
      if (new Set(entities.map((entity) => entity.id)).size !== entities.length) throw new Error("Duplicate entity IDs");
      db.transaction(() => {
        for (const old of list(kind)) if (!entities.some((entity) => entity.id === old.id)) queue(kind, old, true);
        for (const entity of entities) {
          const old = db.select().from(records).where(where(kind, entity.id)).get();
          if (!old || old.deleted || old.payload !== JSON.stringify(entity)) queue(kind, entity, false);
        }
      });
      notify();
    },
    migrateLegacy(collections: { kind: Kind; entities: Entity[] }[]) {
      if (meta("legacy-migrated")) return;
      db.transaction(() => {
        for (const { kind, entities } of collections) for (const entity of parseEntities(kind, entities)) queue(kind, entity, false);
        setMeta("legacy-migrated", "1");
      });
      notify();
    },
    requeueAll() {
      db.transaction(() => {
        for (const row of rows()) queue(row.kind as Kind, JSON.parse(row.payload), row.deleted);
      });
      notify();
    },
    pending() { return db.select().from(outbox).orderBy(asc(outbox.sequence)).limit(100).all(); },
    pendingCount() { return db.select({ value: count() }).from(outbox).get()!.value; },
    cursor() { return Number(meta("cursor") ?? 0); },
    apply(response: SyncResponse, sent: string[]) {
      db.transaction(() => {
        for (const operationId of response.acknowledged) {
          if (!sent.includes(operationId)) throw new Error("Unexpected sync acknowledgement");
          db.delete(outbox).where(eq(outbox.operationId, operationId)).run();
        }
        for (const change of response.changes) {
          // Edits made during an in-flight request remain queued and visible.
          const pending = db.select().from(outbox).where(and(eq(outbox.kind, change.kind), eq(outbox.id, change.id))).get();
          if (!pending) db.insert(records).values(change).onConflictDoUpdate({ target: [records.kind, records.id], set: change }).run();
        }
        if (response.cursor < Number(meta("cursor") ?? 0)) throw new Error("Sync cursor moved backwards");
        setMeta("cursor", String(response.cursor));
        setMeta("last-sync", new Date().toISOString());
      });
      notify();
    },
  };
}
export type Repository = ReturnType<typeof createRepository>;
