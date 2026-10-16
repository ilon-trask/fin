import { requestSchema, type SyncResponse } from "@fin/shared";
import Database from "better-sqlite3";
import { asc, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SyncConflictError } from "./errors";
import { migrateDatabase } from "./migrations";
import { remote, receipts } from "./schema";

const CHANGE_PAGE_SIZE = 500;

export function createSyncStore(filename: string) {
  const sqlite = new Database(filename);
  migrateDatabase(sqlite);
  const db = drizzle(sqlite);

  return {
    close: () => sqlite.close(),
    sync(value: unknown): SyncResponse {
      const request = requestSchema.parse(value);
      return db.transaction(() => {
        let revision = db.select({ value: sql<number>`coalesce(max(${remote.revision}), 0)` })
          .from(remote).get()!.value;
        if (request.cursor > revision) {
          throw new SyncConflictError("Cursor exceeds server revision; restore the original database or reconnect");
        }

        for (const operation of request.operations) {
          const { operationId, ...change } = operation;
          const body = JSON.stringify(change);
          const receipt = db.select().from(receipts)
            .where(eq(receipts.operationId, operationId)).get();
          if (receipt) {
            if (receipt.body !== body) {
              throw new SyncConflictError("Operation ID was reused with different content");
            }
            continue;
          }

          // Server acceptance order resolves concurrent edits. Tombstones and
          // receipts prevent offline devices from replaying old writes.
          revision++;
          const record = { ...change, revision };
          db.insert(remote).values(record)
            .onConflictDoUpdate({ target: [remote.kind, remote.id], set: record }).run();
          db.insert(receipts).values({ operationId, body }).run();
        }

        // Fetch one extra record to tell the client whether another page exists.
        const rows = db.select().from(remote)
          .where(gt(remote.revision, request.cursor))
          .orderBy(asc(remote.revision))
          .limit(CHANGE_PAGE_SIZE + 1).all();
        const page = rows.slice(0, CHANGE_PAGE_SIZE);
        return {
          acknowledged: request.operations.map((operation) => operation.operationId),
          changes: page.map(({ revision: _revision, ...change }) => change),
          cursor: page.at(-1)?.revision ?? request.cursor,
          hasMore: rows.length > CHANGE_PAGE_SIZE,
        };
      });
    },
  };
}
