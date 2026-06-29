/**
 * Migration 001 — Initial schema
 * Creates all base tables for the first version of the app.
 */
export const id = "001_initial_schema";

export const statements = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other'
      CHECK (type IN ('cash','bank','card','savings','other')),
    currency TEXT NOT NULL DEFAULT 'EUR',
    starting_balance REAL NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    exclude_from_total INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT NULL)`,

  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
    parent_id TEXT NULL REFERENCES categories(id),
    icon TEXT NULL,
    color TEXT NULL,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT NULL)`,

  `CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    category_id TEXT NULL REFERENCES categories(id),
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT NULL,
    UNIQUE (category_id, month))`,

  `CREATE TABLE IF NOT EXISTS recurring_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense','income')),
    account_id TEXT NULL REFERENCES accounts(id),
    category_id TEXT NULL REFERENCES categories(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    day_of_month INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT NULL)`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('expense','income','transfer')),
    account_id TEXT NULL REFERENCES accounts(id),
    from_account_id TEXT NULL REFERENCES accounts(id),
    to_account_id TEXT NULL REFERENCES accounts(id),
    category_id TEXT NULL REFERENCES categories(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    occurred_at TEXT NOT NULL,
    note TEXT NULL,
    recurring_template_id TEXT NULL REFERENCES recurring_templates(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT NULL,
    CHECK (
      (type IN ('expense','income') AND account_id IS NOT NULL
        AND from_account_id IS NULL AND to_account_id IS NULL)
      OR
      (type = 'transfer' AND account_id IS NULL
        AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL)
    ))`,

  `CREATE INDEX IF NOT EXISTS idx_transactions_account     ON transactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_from_acct   ON transactions(from_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_to_acct     ON transactions(to_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_category    ON transactions(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_dirty       ON transactions(dirty)`,

  `CREATE TABLE IF NOT EXISTS local_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL)`,

    `INSERT OR IGNORE INTO accounts
    (id, name, type, currency, starting_balance, is_archived, is_deleted, exclude_from_total, dirty, created_at, updated_at)
   VALUES
    ('00000000-0000-4000-a000-000000000001', 'Salary', 'bank', 'EUR', 0, 0, 0, 0, 1, datetime('now'), datetime('now'))`,

  `INSERT OR IGNORE INTO accounts
    (id, name, type, currency, starting_balance, is_archived, is_deleted, exclude_from_total, dirty, created_at, updated_at)
   VALUES
    ('00000000-0000-4000-a000-000000000002', 'Savings', 'savings', 'EUR', 0, 0, 0, 1, 1, datetime('now'), datetime('now'))`,
];