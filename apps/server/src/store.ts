import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { remote, receipts } from "./schema";
import { migrateDatabase } from "./migrations";
import { requestSchema, type SyncResponse } from "@fin/shared";


export function createSyncStore(filename: string) {
  const sqlite = new Database(filename);
  migrateDatabase(sqlite);
  const db = drizzle(sqlite);
  return {
    close: () => sqlite.close(),
    sync(value: unknown): SyncResponse {
      const request = requestSchema.parse(value);
      return db.transaction(() => {
        let revision = db.select({ value: sql<number>`coalesce(max(${remote.revision}), 0)` }).from(remote).get()!.value;
        if (request.cursor > revision) throw new Error("Cursor exceeds server revision; restore the original database or reconnect");
        for (const operation of request.operations) {
          const { operationId, ...change } = operation;
          const body = JSON.stringify(change);
          const existing = db.select().from(receipts).where(eq(receipts.operationId, operationId)).get();
          if (existing) {
            if (existing.body !== body) throw new Error("Operation ID was reused with different content");
            continue;
          }
          // Server acceptance order resolves concurrent edits; device clocks are irrelevant.
          // Keep deletion tombstones and receipts so offline clients cannot replay old writes.
          db.insert(remote).values({ ...change, revision: ++revision }).onConflictDoUpdate({ target: [remote.kind, remote.id], set: { ...change, revision } }).run();
          db.insert(receipts).values({ operationId, body }).run();
        }
        const rows = db.select().from(remote).where(and(gt(remote.revision, request.cursor))).orderBy(asc(remote.revision)).limit(501).all();
        const page = rows.slice(0, 500);
        return {
          acknowledged: request.operations.map((operation) => operation.operationId),
          changes: page.map(({ revision: _, ...change }) => change),
          cursor: page.at(-1)?.revision ?? request.cursor, hasMore: rows.length > 500,
        };
      });
    },
  };
}
