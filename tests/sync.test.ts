import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { createRepository } from "../apps/mobile/data/db/repository";
import { migrateDatabase } from "../apps/mobile/data/db/migrations";
import { createSyncStore } from "../apps/server/src/store";
import { createApp } from "../apps/server/src/app";
import { parseCollection } from "@fin/shared";

const category = { id: "food", name: "Food", color: "#abcdef" };
function client(filename = ":memory:") {
  const sqlite = new Database(filename);
  migrateDatabase({ execSync: (sql) => { sqlite.exec(sql); }, getFirstSync: <T>(sql: string) => sqlite.prepare(sql).get() as T });
  // Repository uses the common synchronous SQLite API; production driver is Expo.
  const repository = createRepository(drizzle(sqlite) as unknown as ExpoSQLiteDatabase, randomUUID);
  return { repository, close: () => sqlite.close() };
}
function sync(repository: ReturnType<typeof createRepository>, server: ReturnType<typeof createSyncStore>) {
  const operations = repository.pending();
  const result = server.sync({ cursor: repository.cursor(), operations });
  repository.apply(result, operations.map((op) => op.operationId));
  return result;
}

test("offline writes and outbox survive restart, migrate once, and sync to a second device", () => {
  const directory = mkdtempSync(join(tmpdir(), "fin-test-"));
  const server = createSyncStore(":memory:");
  const b = client();
  let a = client(join(directory, "local.db"));
  try {
    a.repository.migrateLegacy([{ kind: "categories", entities: [category] }]);
    a.repository.upsert("expenses", { id: "expense", amount: 4.5, date: "2026-01-01", categoryId: category.id, currency: "EUR" });
    assert.equal(a.repository.pendingCount(), 2);
    a.close();
    a = client(join(directory, "local.db"));
    a.repository.migrateLegacy([{ kind: "categories", entities: [{ ...category, name: "Ignored" }] }]);
    assert.deepEqual(a.repository.list("categories"), [category]);
    assert.equal(a.repository.list("expenses").length, 1);
    sync(a.repository, server);
    sync(b.repository, server);
    assert.deepEqual(a.repository.list("expenses"), b.repository.list("expenses"));
    assert.equal(a.repository.pendingCount(), 0);
  } finally { a.close(); b.close(); server.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("lost responses retry idempotently; edits during requests remain visible and converge", () => {
  const a = client(); const b = client(); const server = createSyncStore(":memory:");
  try {
    a.repository.upsert("categories", category);
    const sent = a.repository.pending();
    const request = { cursor: 0, operations: sent };
    const first = server.sync(request);
    assert.deepEqual(server.sync(request), first);
    a.repository.upsert("categories", { ...category, name: "Latest local" });
    a.repository.apply(first, sent.map((op) => op.operationId));
    assert.equal(a.repository.list("categories")[0].name, "Latest local");
    assert.equal(a.repository.pendingCount(), 1);
    sync(a.repository, server); sync(b.repository, server);
    assert.deepEqual(a.repository.list("categories"), b.repository.list("categories"));
    assert.throws(() => server.sync({ cursor: 0, operations: [{ ...sent[0], payload: JSON.stringify({ ...category, name: "Tampered" }) }] }));
  } finally { a.close(); b.close(); server.close(); }
});

test("server acceptance order resolves conflicts and tombstones survive old retries", () => {
  const a = client(); const b = client(); const server = createSyncStore(":memory:");
  try {
    a.repository.upsert("categories", category);
    const oldOperations = a.repository.pending();
    sync(a.repository, server); sync(b.repository, server);
    a.repository.upsert("categories", { ...category, name: "A" });
    b.repository.upsert("categories", { ...category, name: "B" });
    sync(a.repository, server); sync(b.repository, server); sync(a.repository, server);
    assert.equal(a.repository.list("categories")[0].name, "B");
    b.repository.remove("categories", category.id);
    sync(b.repository, server);
    server.sync({ cursor: 0, operations: oldOperations });
    sync(a.repository, server);
    assert.deepEqual(a.repository.list("categories"), []);
  } finally { a.close(); b.close(); server.close(); }
});

test("pagination downloads every record and failed acknowledgements roll back", () => {
  const a = client(); const b = client(); const server = createSyncStore(":memory:");
  try {
    for (let i = 0; i < 620; i++) a.repository.upsert("categories", { ...category, id: `c-${i}` });
    while (a.repository.pendingCount()) sync(a.repository, server);
    assert.equal(sync(b.repository, server).hasMore, true);
    assert.equal(sync(b.repository, server).hasMore, false);
    assert.equal(b.repository.list("categories").length, 620);
    const cursor = b.repository.cursor();
    assert.throws(() => b.repository.apply({ cursor: cursor + 1, acknowledged: ["unknown"], changes: [], hasMore: false }, []));
    assert.equal(b.repository.cursor(), cursor);
  } finally { a.close(); b.close(); server.close(); }
});

test("legacy formats validate and invalid replacement cannot erase local records", () => {
  const a = client();
  try {
    assert.deepEqual(parseCollection("categories", JSON.stringify([category])), [category]);
    assert.deepEqual(parseCollection("categories", JSON.stringify({ version: "0.0", data: [category] })), [category]);
    a.repository.upsert("categories", category);
    assert.throws(() => a.repository.replace("categories", [{ ...category, name: "" }]));
    assert.deepEqual(a.repository.list("categories"), [category]);
    a.repository.upsert("expenses", { id: "pay-1", amount: 10, categoryId: "food", date: "2026-01-01", sourcePaymentId: "payment" });
    a.repository.upsert("expenses", { id: "pay-2", amount: 10, categoryId: "food", date: "2026-01-01", sourcePaymentId: "payment" });
    assert.equal(a.repository.list("expenses").length, 1);
  } finally { a.close(); }
});

test("Hono protects sync, validates payloads, handles CORS and accepts valid batches", async () => {
  const server = createSyncStore(":memory:");
  const token = "test-secret";
  const app = createApp(server, token, "https://fin.example");
  try {
    assert.equal((await app.request("/health")).status, 200);
    assert.equal((await app.request("/sync", { method: "POST" })).status, 401);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Origin: "https://fin.example" };
    assert.equal((await app.request("/sync", { method: "POST", headers, body: "{}" })).status, 400);
    const response = await app.request("/sync", { method: "POST", headers, body: JSON.stringify({ cursor: 0, operations: [{ kind: "categories", id: category.id, payload: JSON.stringify(category), deleted: false, operationId: "operation" }] }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://fin.example");
    assert.equal((await response.json()).changes.length, 1);
    assert.equal((await app.request("/sync", { method: "OPTIONS", headers: { Origin: "https://fin.example", "Access-Control-Request-Method": "POST" } })).status, 204);
  } finally { server.close(); }
});

test("HTTP sync preserves the outbox on network failure and drains it on reconnect", async () => {
  const { exchange } = await import("../apps/mobile/data/sync/engine");
  const a = client(); const server = createSyncStore(":memory:");
  const app = createApp(server, "test-token");
  const originalFetch = globalThis.fetch;
  try {
    a.repository.upsert("categories", category);
    globalThis.fetch = async () => { throw new Error("Offline"); };
    await assert.rejects(exchange(a.repository, "https://sync.example", "test-token"), /Offline/);
    assert.equal(a.repository.pendingCount(), 1);
    assert.deepEqual(a.repository.list("categories"), [category]);
    globalThis.fetch = async (input, init) => app.request(String(input), init);
    assert.equal(await exchange(a.repository, "https://sync.example", "test-token"), false);
    assert.equal(a.repository.pendingCount(), 0);
    assert.deepEqual(a.repository.list("categories"), [category]);
  } finally { globalThis.fetch = originalFetch; a.close(); server.close(); }
});

test("Expo SQLite web bridge preserves result lengths above 255 bytes", async () => {
  const { sendWorkerResult } = await import("../node_modules/expo-sqlite/web/WorkerChannel");
  const lockBuffer = new SharedArrayBuffer(4);
  const resultBuffer = new SharedArrayBuffer(4096);
  sendWorkerResult({ id: 1, result: "x".repeat(700) as never, error: null, syncTrait: { lockBuffer, resultBuffer } });
  const length = new Uint32Array(resultBuffer, 0, 1)[0];
  assert.ok(length > 700);
  const text = new TextDecoder().decode(new Uint8Array(resultBuffer, 4, length));
  assert.doesNotThrow(() => JSON.parse(text));
});
