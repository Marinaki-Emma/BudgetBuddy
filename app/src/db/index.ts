/**
 * Database initialization and migration runner.
 *
 * On every app start, initDatabase():
 *   1. Opens (or creates) the SQLite file
 *   2. Sets per-connection pragmas (foreign keys, WAL mode)
 *   3. Ensures the `migrations` table exists
 *   4. Runs any migrations that haven't been applied yet, in order
 *
 * To add a new migration, create a file in migrations/ and register
 * it in migrations/index.ts — no other changes needed here.
 */
import * as SQLite from "expo-sqlite";
import { migrations } from "./migrations";

const DB_NAME = "budget_buddy1.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  // If an open is already in flight, reuse it instead of opening a second time.
  // Two concurrent opens make the second fail with "NoModificationAllowedError"
  // on web, because OPFS file handles are exclusive.
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    // These pragmas must be set on every connection, not just once.
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await db.execAsync("PRAGMA journal_mode = WAL;");

    await runMigrations(db);

    dbInstance = db;
    return db;
  })();

  try {
    return await initPromise;
  } catch (e) {
    // Allow a later call to retry if this open failed.
    initPromise = null;
    throw e;
  }
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error(
      "Database not initialized yet — call initDatabase() before getDatabase()."
    );
  }
  return dbInstance;
}

/**
 * Creates the migrations tracking table if it doesn't exist, then
 * runs any pending migrations in registration order.
 *
 * Each migration is atomic: if any statement in it fails, the whole
 * migration is rolled back and the error is re-thrown. This keeps the
 * database in a consistent state — a migration either fully applied
 * or not applied at all.
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Bootstrap: create the migrations table itself (always safe to run)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  for (const migration of migrations) {
    // Check if already applied
    const existing = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM migrations WHERE id = ?",
      [migration.id]
    );

    if (existing) continue; // already done, skip

    // Run each statement in the migration
    try {
      await db.runAsync("BEGIN");
      for (const sql of migration.statements) {
        await db.runAsync(sql);
      }
      // Record it as applied
      await db.runAsync(
        "INSERT INTO migrations (id, applied_at) VALUES (?, ?)",
        [migration.id, new Date().toISOString()]
      );
      await db.runAsync("COMMIT");

      console.log(`[migrations] Applied: ${migration.id}`);
    } catch (e) {
      await db.runAsync("ROLLBACK");
      console.error(`[migrations] Failed: ${migration.id}`, e);
      throw e;
    }
  }
}