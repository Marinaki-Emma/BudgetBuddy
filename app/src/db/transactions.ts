/**
 * All database operations for transactions and categories.
 */
import { getDatabase } from "./index";

export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income";
  parent_id: string | null;
  icon: string | null;
  color: string | null;
}

export interface Transaction {
  id: string;
  type: "expense" | "income" | "transfer";
  account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  amount: number;
  currency: string;
  occurred_at: string;
  note: string | null;
  // joined fields
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  account_name: string | null;
}

export interface TransactionGroup {
  date: string; // e.g. "2026-06-17"
  label: string; // e.g. "Today", "Yesterday", "Mon 16 Jun"
  transactions: Transaction[];
  total: number; // net for the day (income - expense)
}

/** Seeds default categories if the table is empty. */
export async function seedCategoriesIfEmpty(): Promise<void> {
  const db = getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories WHERE is_deleted = 0"
  );
  if (result && result.count > 0) return;

  const now = new Date().toISOString();
  const categories = [
    // Expenses
    { id: uuid(), name: "Food & Drink",   kind: "expense", icon: "🍔", color: "#F87171" },
    { id: uuid(), name: "Groceries",      kind: "expense", icon: "🛒", color: "#FB923C" },
    { id: uuid(), name: "Transport",      kind: "expense", icon: "🚌", color: "#FBBF24" },
    { id: uuid(), name: "Housing",        kind: "expense", icon: "🏠", color: "#A78BFA" },
    { id: uuid(), name: "Utilities",      kind: "expense", icon: "💡", color: "#60A5FA" },
    { id: uuid(), name: "Health",         kind: "expense", icon: "💊", color: "#34D399" },
    { id: uuid(), name: "Shopping",       kind: "expense", icon: "🛍️", color: "#F472B6" },
    { id: uuid(), name: "Entertainment", kind: "expense", icon: "🎬", color: "#818CF8" },
    { id: uuid(), name: "Subscriptions", kind: "expense", icon: "📱", color: "#38BDF8" },
    { id: uuid(), name: "Education",      kind: "expense", icon: "📚", color: "#4ADE80" },
    { id: uuid(), name: "Other",          kind: "expense", icon: "📂", color: "#94A3B8" },
    // Income
    { id: uuid(), name: "Salary",         kind: "income", icon: "💼", color: "#4ADE80" },
    { id: uuid(), name: "Freelance",      kind: "income", icon: "💻", color: "#34D399" },
    { id: uuid(), name: "Gift",           kind: "income", icon: "🎁", color: "#A78BFA" },
    { id: uuid(), name: "Other Income",   kind: "income", icon: "💰", color: "#FBBF24" },
  ];

  for (const cat of categories) {
    await db.runAsync(
      `INSERT INTO categories (id, name, kind, icon, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cat.id, cat.name, cat.kind, cat.icon, cat.color, now, now]
    );
  }

  // Seed a default monthly salary recurring template
  const salaryCategory = categories.find((c) => c.name === "Salary");
  if (salaryCategory) {
    await db.runAsync(
      `INSERT OR IGNORE INTO recurring_templates
        (id, name, type, account_id, category_id, amount, currency, day_of_month, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "00000000-0000-4000-a000-000000000001",
        "Monthly Salary",
        "income",
        "00000000-0000-4000-a000-000000000001", 
        salaryCategory.id,
        0,
        "EUR",
        1,
        1,
        now,
        now,
      ]
    );
  }
}

export async function getCategories(kind?: "expense" | "income"): Promise<Category[]> {
  const db = getDatabase();
  const where = kind ? `AND kind = '${kind}'` : "";
  return await db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE is_deleted = 0 ${where}
     ORDER BY (name IN ('Other', 'Other Income')) ASC, name ASC`
  );
}

export async function createTransaction(params: {
  type: "expense" | "income" | "transfer";
  account_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  category_id?: string;
  amount: number;
  currency?: string;
  occurred_at: string;
  note?: string;
}): Promise<string> {
  const db = getDatabase();
  const id = uuid();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO transactions
       (id, type, account_id, from_account_id, to_account_id, category_id,
        amount, currency, occurred_at, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.type,
      params.account_id ?? null,
      params.from_account_id ?? null,
      params.to_account_id ?? null,
      params.category_id ?? null,
      params.amount,
      params.currency ?? "EUR",
      params.occurred_at,
      params.note ?? null,
      now,
      now,
    ]
  );
  return id;
}

/** Fetches all non-deleted transactions with joined category/account names. */
async function fetchAllTransactions(): Promise<Transaction[]> {
  const db = getDatabase();
  return await db.getAllAsync<Transaction>(`
    SELECT
      t.id, t.type, t.account_id, t.from_account_id, t.to_account_id,
      t.category_id, t.amount, t.currency, t.occurred_at, t.note,
      c.name  AS category_name,
      c.icon  AS category_icon,
      c.color AS category_color,
      COALESCE(a.name, fa.name) AS account_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts   a ON a.id = t.account_id
    LEFT JOIN accounts  fa ON fa.id = t.from_account_id
    WHERE t.is_deleted = 0
    ORDER BY t.occurred_at DESC, t.created_at DESC
  `);
}

/** Sums a list of transactions into a net total (income − expense). */
function netTotal(txns: Transaction[]): number {
  return txns.reduce((sum, t) => {
    if (t.type === "income")  return sum + t.amount;
    if (t.type === "expense") return sum - t.amount;
    return sum;
  }, 0);
}

/** Groups a flat list of transactions by a key function, preserving order. */
function groupBy(
  rows: Transaction[],
  keyFn: (t: Transaction) => string,
  labelFn: (key: string) => string,
): TransactionGroup[] {
  const groups: Map<string, Transaction[]> = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return Array.from(groups.entries()).map(([key, txns]) => ({
    date: key,
    label: labelFn(key),
    transactions: txns,
    total: netTotal(txns),
  }));
}

/** Returns transactions grouped by day, most recent first. */
export async function getTransactionsGroupedByDay(): Promise<TransactionGroup[]> {
  const rows  = await fetchAllTransactions();
  const today     = toLocalDateString(new Date());
  const yesterday = toLocalDateString(new Date(Date.now() - 86400000));

  return groupBy(
    rows,
    (t) => t.occurred_at.slice(0, 10),
    (date) =>
      date === today     ? "Today" :
      date === yesterday ? "Yesterday" :
      formatDateLabel(date),
  );
}

/** Returns transactions grouped by ISO week (Mon–Sun), most recent first. */
export async function getTransactionsGroupedByWeek(): Promise<TransactionGroup[]> {
  const rows = await fetchAllTransactions();

  return groupBy(
    rows,
    (t) => isoWeekKey(t.occurred_at.slice(0, 10)),
    (key) => {
      // key is "YYYY-Www", e.g. "2026-W26"
      const [year, week] = key.split("-W");
      const monday = mondayOfISOWeek(parseInt(year), parseInt(week));
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      const thisWeekKey = isoWeekKey(toLocalDateString(new Date()));
      if (key === thisWeekKey) return "This week";
      return `${monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${
              sunday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    },
  );
}

/** Returns transactions grouped by calendar month, most recent first. */
export async function getTransactionsGroupedByMonth(): Promise<TransactionGroup[]> {
  const rows = await fetchAllTransactions();

  return groupBy(
    rows,
    (t) => t.occurred_at.slice(0, 7), // "YYYY-MM"
    (key) => {
      const [year, month] = key.split("-").map(Number);
      const now = new Date();
      const isThisMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
      if (isThisMonth) return "This month";
      return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
        month: "long", year: "numeric",
      });
    },
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE transactions SET is_deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?`,
    [now, id]
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

/** Returns the ISO week key for a date string, e.g. "2026-W26". */
function isoWeekKey(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  // ISO week: week containing Thursday of that week belongs to that year.
  const day = date.getDay() === 0 ? 7 : date.getDay(); // Mon=1 … Sun=7
  const thursday = new Date(date.getTime() + (4 - day) * 86400000);
  const year = thursday.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(((thursday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Returns the Monday of a given ISO year+week. */
function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4); // Jan 4 is always in week 1
  const day  = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const monday = new Date(jan4.getTime() - (day - 1) * 86400000 + (week - 1) * 7 * 86400000);
  return monday;
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Returns transactions for a specific account, grouped by day. */
export async function getTransactionsByAccount(accountId: string): Promise<TransactionGroup[]> {
  const db = getDatabase();

  const rows = await db.getAllAsync<Transaction>(`
    SELECT
      t.id, t.type, t.account_id, t.from_account_id, t.to_account_id,
      t.category_id, t.amount, t.currency, t.occurred_at, t.note,
      c.name  AS category_name,
      c.icon  AS category_icon,
      c.color AS category_color,
      COALESCE(a.name, fa.name, ta.name) AS account_name
    FROM transactions t
    LEFT JOIN categories c  ON c.id  = t.category_id
    LEFT JOIN accounts   a  ON a.id  = t.account_id
    LEFT JOIN accounts  fa  ON fa.id = t.from_account_id
    LEFT JOIN accounts  ta  ON ta.id = t.to_account_id
    WHERE t.is_deleted = 0
      AND (t.account_id = ? OR t.from_account_id = ? OR t.to_account_id = ?)
    ORDER BY t.occurred_at DESC, t.created_at DESC
  `, [accountId, accountId, accountId]);

  const groups: Map<string, Transaction[]> = new Map();
  for (const row of rows) {
    const date = row.occurred_at.slice(0, 10);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(row);
  }

  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return Array.from(groups.entries()).map(([date, txns]) => ({
    date,
    label: date === today ? "Today" : date === yesterday ? "Yesterday" : formatDateLabel(date),
    transactions: txns,
    total: txns.reduce((sum, t) => {
      if (t.type === "income") return sum + t.amount;
      if (t.type === "expense") return sum - t.amount;
      return sum;
    }, 0),
  }));
}