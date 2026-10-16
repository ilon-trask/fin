import { and, asc, count, eq, gt, or } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { serializeBackup, validateBackup } from "../backup";
import { parseEntities, type Entity, type Kind, type SyncResponse } from "../sync/protocol";
import { metadata, outbox, records } from "./schema";

type RecordRow = typeof records.$inferSelect;
const PAGE_SIZE = 100;

export function createRepository(db: ExpoSQLiteDatabase, newId: () => string) {
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function recordKey(kind: Kind, id: string) {
    return and(eq(records.kind, kind), eq(records.id, id));
  }

  function findRecord(kind: Kind, id: string) {
    return db.select().from(records).where(recordKey(kind, id)).get();
  }

  function meta(key: string) {
    return db.select().from(metadata).where(eq(metadata.key, key)).get()?.value;
  }

  function setMeta(key: string, value: string) {
    db.insert(metadata).values({ key, value })
      .onConflictDoUpdate({ target: metadata.key, set: { value } }).run();
  }

  function queueChange(kind: Kind, entity: Entity, deleted: boolean) {
    const row = { kind, id: entity.id, payload: JSON.stringify(entity), deleted };
    db.insert(records).values(row)
      .onConflictDoUpdate({ target: [records.kind, records.id], set: row }).run();

    const sequence = Number(meta("sequence") ?? 0) + 1;
    setMeta("sequence", String(sequence));
    db.insert(outbox).values({ ...row, operationId: newId(), sequence }).run();
  }

  function readRows(kind?: Kind, activeOnly = false): RecordRow[] {
    const result: RecordRow[] = [];
    let last: RecordRow | undefined;

    // Bounded pages avoid a large SQLite bridge response. The last key avoids
    // scanning all previous pages again, as OFFSET would do.
    while (true) {
      const afterLast = last
        ? or(gt(records.kind, last.kind), and(eq(records.kind, last.kind), gt(records.id, last.id)))
        : undefined;
      const page: RecordRow[] = db.select().from(records).where(and(
        kind ? eq(records.kind, kind) : undefined,
        activeOnly ? eq(records.deleted, false) : undefined,
        afterLast,
      )).orderBy(asc(records.kind), asc(records.id)).limit(PAGE_SIZE).all();

      result.push(...page);
      if (page.length < PAGE_SIZE) return result;
      last = page[page.length - 1];
    }
  }

  function list(kind: Kind): Entity[] {
    return readRows(kind, true).map((row) => JSON.parse(row.payload));
  }

  function hasDuplicatePayment(entity: Entity): boolean {
    if (!("sourcePaymentId" in entity) || !entity.sourcePaymentId) return false;
    return readRows("expenses").some((row) => {
      const saved = JSON.parse(row.payload) as Entity;
      return "sourcePaymentId" in saved
        && saved.sourcePaymentId === entity.sourcePaymentId
        && (row.deleted || row.id !== entity.id);
    });
  }

  return {
    list,
    meta,
    setMeta,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    exportBackup() {
      return db.transaction(() => serializeBackup(
        list("categories") as Parameters<typeof serializeBackup>[0],
        list("expenses") as Parameters<typeof serializeBackup>[1],
      ));
    },

    importBackup(value: unknown) {
      const backup = validateBackup(value);
      const result = { categories: 0, expenses: 0, skipped: 0 };
      db.transaction(() => {
        const existing = readRows();
        const keys = new Set(existing.map((row) => JSON.stringify([row.kind, row.id])));
        const paymentIds = new Set(existing
          .filter((row) => row.kind === "expenses")
          .map((row) => (JSON.parse(row.payload) as { sourcePaymentId?: string }).sourcePaymentId)
          .filter((id): id is string => Boolean(id)));

        for (const kind of ["categories", "expenses"] as const) {
          for (const entity of backup[kind]) {
            const key = JSON.stringify([kind, entity.id]);
            const paymentId = "sourcePaymentId" in entity ? entity.sourcePaymentId : undefined;
            // Existing records, including tombstones, retain their current state.
            if (keys.has(key) || (paymentId && paymentIds.has(paymentId))) {
              result.skipped++;
              continue;
            }
            queueChange(kind, entity, false);
            keys.add(key);
            result[kind]++;
            if (paymentId) paymentIds.add(paymentId);
          }
        }
      });
      if (result.categories || result.expenses) notify();
      return result;
    },

    upsert(kind: Kind, value: Entity) {
      const entity = parseEntities(kind, [value])[0];
      const changed = db.transaction(() => {
        // Tombstones prevent a dismissed payment reminder from returning.
        if (kind === "expenses" && hasDuplicatePayment(entity)) return false;
        const existing = findRecord(kind, entity.id);
        if (existing && !existing.deleted && existing.payload === JSON.stringify(entity)) return false;
        queueChange(kind, entity, false);
        return true;
      });
      if (changed) notify();
    },

    remove(kind: Kind, id: string) {
      const changed = db.transaction(() => {
        const row = findRecord(kind, id);
        if (!row || row.deleted) return false;
        queueChange(kind, JSON.parse(row.payload), true);
        return true;
      });
      if (changed) notify();
    },

    replace(kind: Kind, values: Entity[]) {
      const entities = parseEntities(kind, values);
      const ids = new Set(entities.map((entity) => entity.id));
      if (ids.size !== entities.length) throw new Error("Duplicate entity IDs");

      const changed = db.transaction(() => {
        const existing = new Map(readRows(kind).map((row) => [row.id, row]));
        let changed = false;
        for (const row of existing.values()) {
          if (row.deleted || ids.has(row.id)) continue;
          queueChange(kind, JSON.parse(row.payload), true);
          changed = true;
        }
        for (const entity of entities) {
          const old = existing.get(entity.id);
          if (old && !old.deleted && old.payload === JSON.stringify(entity)) continue;
          queueChange(kind, entity, false);
          changed = true;
        }
        return changed;
      });
      if (changed) notify();
    },

    migrateLegacy(collections: { kind: Kind; entities: Entity[] }[]) {
      if (meta("legacy-migrated")) return;
      db.transaction(() => {
        for (const { kind, entities } of collections) {
          for (const entity of parseEntities(kind, entities)) queueChange(kind, entity, false);
        }
        setMeta("legacy-migrated", "1");
      });
      notify();
    },

    requeueAll() {
      db.transaction(() => {
        for (const row of readRows()) {
          queueChange(row.kind, JSON.parse(row.payload), row.deleted);
        }
      });
      notify();
    },

    pending() {
      return db.select().from(outbox).orderBy(asc(outbox.sequence)).limit(PAGE_SIZE).all();
    },
    pendingCount() {
      return db.select({ value: count() }).from(outbox).get()!.value;
    },
    cursor() {
      return Number(meta("cursor") ?? 0);
    },

    apply(response: SyncResponse, sent: string[]) {
      const sentIds = new Set(sent);
      db.transaction(() => {
        for (const operationId of response.acknowledged) {
          if (!sentIds.has(operationId)) throw new Error("Unexpected sync acknowledgement");
          db.delete(outbox).where(eq(outbox.operationId, operationId)).run();
        }

        for (const change of response.changes) {
          // Local edits made during the request remain visible and queued.
          const pending = db.select().from(outbox).where(and(
            eq(outbox.kind, change.kind),
            eq(outbox.id, change.id),
          )).get();
          if (pending) continue;
          db.insert(records).values(change)
            .onConflictDoUpdate({ target: [records.kind, records.id], set: change }).run();
        }

        if (response.cursor < Number(meta("cursor") ?? 0)) {
          throw new Error("Sync cursor moved backwards");
        }
        setMeta("cursor", String(response.cursor));
        setMeta("last-sync", new Date().toISOString());
      });
      if (response.acknowledged.length || response.changes.length) notify();
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
