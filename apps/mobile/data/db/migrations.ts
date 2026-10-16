// Append migrations; never modify an applied migration. Both drivers use this SQL.
export const migrations = [{ version: 1, sql: `
CREATE TABLE records (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (kind, id));
CREATE TABLE outbox (operation_id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, deleted INTEGER NOT NULL, sequence INTEGER NOT NULL);
CREATE INDEX outbox_sequence ON outbox(sequence);
CREATE TABLE metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
` }, { version: 2, sql: `
CREATE INDEX outbox_record ON outbox(kind, id);
` }];
export function migrateDatabase(sqlite: { execSync(sql: string): void; getFirstSync<T>(sql: string): T | null }) {
  sqlite.execSync("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  const current = sqlite.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0;
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    sqlite.execSync("BEGIN IMMEDIATE");
    try {
      sqlite.execSync(migration.sql);
      sqlite.execSync(`PRAGMA user_version = ${migration.version}; COMMIT;`);
    } catch (error) { sqlite.execSync("ROLLBACK"); throw error; }
  }
}
