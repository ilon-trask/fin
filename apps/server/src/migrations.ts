import type Database from "better-sqlite3";
const migrations = [{ version: 1, sql: `
CREATE TABLE IF NOT EXISTS remote_records (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, deleted INTEGER NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(kind,id));
CREATE INDEX IF NOT EXISTS remote_revision ON remote_records(revision);
CREATE TABLE IF NOT EXISTS receipts (operation_id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);
` }];
export function migrateDatabase(sqlite: Database.Database) {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  const current = sqlite.pragma("user_version", { simple: true }) as number;
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    sqlite.transaction(() => { sqlite.exec(migration.sql); sqlite.pragma(`user_version = ${migration.version}`); })();
  }
}
