/**
 * All database queries for the reports screen.
 */
import { getDatabase } from "./index";

export interface MonthlySummary {
  month: string;       // "YYYY-MM-01"
  label: string;       // "Jun 2026"
  income: number;
  expenses: number;
  net: number;
}

export interface CategorySpend {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
  total: number;
  percentage: number;
}

/** Returns summary for a single month. */
export async function getMonthlySummary(month: string): Promise<MonthlySummary> {
  const db = getDatabase();
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const start = `${month.slice(0, 7)}-01`;
  const end   = `${month.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;

  const income = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE type = 'income' AND is_deleted = 0 AND occurred_at >= ? AND occurred_at <= ?`,
    [start, end]
  );
  const expenses = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE type = 'expense' AND is_deleted = 0 AND occurred_at >= ? AND occurred_at <= ?`,
    [start, end]
  );

  const inc = income?.total ?? 0;
  const exp = expenses?.total ?? 0;

  return {
    month,
    label: new Date(year, mon - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    income: inc,
    expenses: exp,
    net: inc - exp,
  };
}

/** Returns summaries for the last N months. */
export async function getLastNMonthsSummary(n: number): Promise<MonthlySummary[]> {
  const results: MonthlySummary[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    results.push(await getMonthlySummary(month));
  }
  return results;
}

/** Returns spending broken down by category for a month. */
export async function getCategorySpend(month: string): Promise<CategorySpend[]> {
  const db = getDatabase();
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const start = `${month.slice(0, 7)}-01`;
  const end   = `${month.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db.getAllAsync<{
    category_id: string;
    category_name: string;
    category_icon: string | null;
    category_color: string | null;
    total: number;
  }>(`
    SELECT
      c.id   AS category_id,
      c.name AS category_name,
      c.icon AS category_icon,
      c.color AS category_color,
      COALESCE(SUM(t.amount), 0) AS total
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id
      AND t.type = 'expense' AND t.is_deleted = 0
      AND t.occurred_at >= ? AND t.occurred_at <= ?
    WHERE c.kind = 'expense' AND c.is_deleted = 0
    GROUP BY c.id
    HAVING total > 0
    ORDER BY total DESC
  `, [start, end]);

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return rows.map((r) => ({
    ...r,
    percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
  }));
}

export interface AccountBalance {
  account_id: string;
  account_name: string;
  account_type: string;
  balance: number;
  exclude_from_total: number;
}

export interface AccountActivity {
  account_id: string;
  account_name: string;
  account_type: string;
  income: number;
  expenses: number;
  net: number;
}

/** Returns current balance for every non-deleted, non-archived account. */
export async function getAccountBalances(): Promise<AccountBalance[]> {
  const db = getDatabase();
  return await db.getAllAsync<AccountBalance>(`
    SELECT
      a.id AS account_id,
      a.name AS account_name,
      a.type AS account_type,
      a.exclude_from_total,
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

/** Returns income/expense activity per account for a given month. */
export async function getAccountActivity(month: string): Promise<AccountActivity[]> {
  const db = getDatabase();
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const start = `${month.slice(0, 7)}-01`;
  const end   = `${month.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;

  const accounts = await db.getAllAsync<{ id: string; name: string; type: string }>(`
    SELECT id, name, type FROM accounts WHERE is_deleted = 0 AND is_archived = 0 ORDER BY created_at ASC
  `);

  const results: AccountActivity[] = [];

  for (const account of accounts) {
    const income = await db.getFirstAsync<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE type = 'income' AND account_id = ? AND is_deleted = 0
        AND occurred_at >= ? AND occurred_at <= ?
    `, [account.id, start, end]);

    const expenses = await db.getFirstAsync<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE type = 'expense' AND account_id = ? AND is_deleted = 0
        AND occurred_at >= ? AND occurred_at <= ?
    `, [account.id, start, end]);

    const transfers_in = await db.getFirstAsync<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE type = 'transfer' AND to_account_id = ? AND is_deleted = 0
        AND occurred_at >= ? AND occurred_at <= ?
    `, [account.id, start, end]);

    const transfers_out = await db.getFirstAsync<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE type = 'transfer' AND from_account_id = ? AND is_deleted = 0
        AND occurred_at >= ? AND occurred_at <= ?
    `, [account.id, start, end]);

    const inc = (income?.total ?? 0) + (transfers_in?.total ?? 0);
    const exp = (expenses?.total ?? 0) + (transfers_out?.total ?? 0);

    // Only include accounts that had any activity
    if (inc > 0 || exp > 0) {
      results.push({
        account_id: account.id,
        account_name: account.name,
        account_type: account.type,
        income: inc,
        expenses: exp,
        net: inc - exp,
      });
    }
  }

  return results;
}

/** Returns all months that have at least one transaction. */
export async function getTransactionMonths(): Promise<string[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ month: string }>(`
    SELECT DISTINCT strftime('%Y-%m-01', occurred_at) as month
    FROM transactions WHERE is_deleted = 0
    ORDER BY month DESC
  `);
  return rows.map((r) => r.month);
}