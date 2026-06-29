/**
 * All database operations for accounts.
 * Screens import from here — no raw SQL in UI code.
 */
import { getDatabase } from "./index";

export interface Account {
  id: string;
  name: string;
  type: "cash" | "bank" | "card" | "savings" | "other";
  currency: string;
  starting_balance: number;
  is_archived: number;
  balance?: number;
  exclude_from_total: number;
}

/** Returns all non-deleted, non-archived accounts with derived balance. */
export async function getAccounts(): Promise<Account[]> {
  const db = getDatabase();
  return await db.getAllAsync<Account>(`
    SELECT
      a.id, a.name, a.type, a.currency, a.starting_balance, a.is_archived, a.exclude_from_total,
      a.starting_balance + COALESCE((
        SELECT SUM(
          CASE
            WHEN t.type = 'income'   THEN  t.amount
            WHEN t.type = 'expense'  THEN -t.amount
            WHEN t.type = 'transfer' AND t.to_account_id   = a.id THEN  t.amount
            WHEN t.type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
            ELSE 0
          END
        )
        FROM transactions t
        WHERE (t.account_id = a.id OR t.from_account_id = a.id OR t.to_account_id = a.id)
          AND t.is_deleted = 0
      ), 0) AS balance
    FROM accounts a
    WHERE a.is_deleted = 0 AND a.is_archived = 0
    ORDER BY a.created_at ASC
  `);
}

/** Returns a single account by id with derived balance. */
export async function getAccountById(id: string): Promise<Account | null> {
  const db = getDatabase();
  return await db.getFirstAsync<Account>(`
    SELECT
      a.id, a.name, a.type, a.currency, a.starting_balance, a.is_archived, a.exclude_from_total,
      a.starting_balance + COALESCE((
        SELECT SUM(
          CASE
            WHEN t.type = 'income'   THEN  t.amount
            WHEN t.type = 'expense'  THEN -t.amount
            WHEN t.type = 'transfer' AND t.to_account_id   = a.id THEN  t.amount
            WHEN t.type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
            ELSE 0
          END
        )
        FROM transactions t
        WHERE (t.account_id = a.id OR t.from_account_id = a.id OR t.to_account_id = a.id)
          AND t.is_deleted = 0
      ), 0) AS balance
    FROM accounts a
    WHERE a.id = ? AND a.is_deleted = 0
  `, [id]) ?? null;
}

/** Inserts a new account. Returns the new account's id. */
export async function createAccount(params: {
  name: string;
  type: Account["type"];
  currency: string;
  starting_balance: number;
  exclude_from_total?: boolean;
}): Promise<string> {
  const db = getDatabase();
  const id = generateUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, currency, starting_balance, exclude_from_total, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.name, params.type, params.currency, params.starting_balance, params.exclude_from_total ? 1 : 0, now, now]
  );
  return id;
}

/** Updates account name and/or type. */
export async function updateAccount(id: string, params: {
  name: string;
  type: Account["type"];
  exclude_from_total: boolean;
  starting_balance: number;
}): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, exclude_from_total = ?, starting_balance = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
    [params.name, params.type, params.exclude_from_total ? 1 : 0, params.starting_balance, now, id]
  );
}

/** Soft-deletes an account. */
export async function deleteAccount(id: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE accounts SET is_deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?`,
    [now, id]
  );
}

/** Removes the smoke-test account created on first launch. */
export async function removeTestAccount(): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM accounts WHERE name = 'Cash (test)'`);
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}