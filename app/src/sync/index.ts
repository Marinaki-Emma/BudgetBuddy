/**
 * Client-side sync logic.
 *
 * push() — collects all dirty rows from SQLite and sends them to the server.
 * pull() — fetches rows updated since last sync and merges them into SQLite.
 * sync() — runs push then pull in sequence.
 *
 * The device_id is stored in local_meta and generated once on first launch.
 * last_synced_at is also stored in local_meta and updated after each successful sync.
 *
 * Conflict resolution: last-write-wins on updated_at. The server handles
 * this during push; pull simply overwrites local rows with server versions
 * since the server is the single source of truth after a push.
 */
import { getDatabase } from "../db";

const SYNC_URL = process.env.EXPO_PUBLIC_SYNC_URL ?? "";
const SYNC_TOKEN = process.env.EXPO_PUBLIC_SYNC_TOKEN ?? "";

const TABLES = [
  "accounts",
  "categories",
  "recurring_templates",
  "budgets",
  "transactions",
] as const;

type TableName = typeof TABLES[number];

// ─── Local meta helpers ───────────────────────────────────────────────────────

async function getMeta(key: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_meta WHERE key = ?", [key]
  );
  return row?.value ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO local_meta (key, value) VALUES (?, ?)", [key, value]
  );
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getMeta("device_id");
  if (existing) return existing;
  const id = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  await setMeta("device_id", id);
  return id;
}

// ─── Dirty row collection ─────────────────────────────────────────────────────

async function getDirtyRows(table: TableName): Promise<Record<string, unknown>[]> {
  const db = getDatabase();
  return await db.getAllAsync(`SELECT * FROM ${table} WHERE dirty = 1`);
}

async function markSynced(table: TableName, ids: string[], syncedAt: string): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE ${table} SET dirty = 0, last_synced_at = ? WHERE id IN (${placeholders})`,
    [syncedAt, ...ids]
  );
}

// ─── Pull merge ───────────────────────────────────────────────────────────────

async function mergeRows(table: TableName, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDatabase();
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => "?").join(", ");
    const updates = columns.map((c) => `${c} = excluded.${c}`).join(", ");
    await db.runAsync(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${updates}`,
      Object.values(row) as any[]
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function push(): Promise<{ pushed: number }> {
  if (!SYNC_URL || !SYNC_TOKEN) throw new Error("Sync not configured.");
  const deviceId = await getOrCreateDeviceId();

  const payload: Record<string, unknown> = { device_id: deviceId };
  const dirtyIds: Partial<Record<TableName, string[]>> = {};

  for (const table of TABLES) {
    const rows = await getDirtyRows(table);
    payload[table] = rows;
    dirtyIds[table] = rows.map((r) => r.id as string);
  }

  const totalDirty = TABLES.reduce((n, t) => n + (dirtyIds[t]?.length ?? 0), 0);
  if (totalDirty === 0) return { pushed: 0 };

  const res = await fetch(`${SYNC_URL}/sync/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SYNC_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Push failed: ${res.status} ${await res.text()}`);

  const { synced_at } = await res.json();
  for (const table of TABLES) {
    await markSynced(table, dirtyIds[table] ?? [], synced_at);
  }
  await setMeta("last_synced_at", synced_at);

  return { pushed: totalDirty };
}

export async function pull(): Promise<{ pulled: number }> {
  if (!SYNC_URL || !SYNC_TOKEN) throw new Error("Sync not configured.");
  const deviceId = await getOrCreateDeviceId();
  const since = await getMeta("last_synced_at");

  const res = await fetch(`${SYNC_URL}/sync/pull`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SYNC_TOKEN}`,
    },
    body: JSON.stringify({ device_id: deviceId, since }),
  });

  if (!res.ok) throw new Error(`Pull failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  let totalPulled = 0;

  for (const table of TABLES) {
    const rows = data[table] ?? [];
    await mergeRows(table, rows);
    totalPulled += rows.length;
  }

  await setMeta("last_synced_at", data.server_time);
  return { pulled: totalPulled };
}

export async function sync(): Promise<{ pushed: number; pulled: number }> {
  const pushResult = await push();
  const pullResult = await pull();
  return { pushed: pushResult.pushed, pulled: pullResult.pulled };
}

export async function isSyncConfigured(): Promise<boolean> {
  return Boolean(SYNC_URL && SYNC_TOKEN);
}