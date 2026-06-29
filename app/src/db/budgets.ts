/**
 * All database operations for budgets.
 */
import { getDatabase } from "./index";

export interface Budget {
  id: string;
  category_id: string | null;
  month: string; // YYYY-MM-01
  amount: number;
  // joined
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
}

export interface BudgetWithSpent extends Budget {
  spent: number;
  remaining: number;
  percentage: number; // 0-100+
}

/** Returns all budgets for a given month with actual spending calculated. */
export async function getBudgetsForMonth(month: string): Promise<BudgetWithSpent[]> {
  const db = getDatabase();

  // month is e.g. "2026-06-01"
  const [year, mon] = month.split("-");
  const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
  const monthStart = `${year}-${mon}-01`;
  const monthEnd   = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;

  const budgets = await db.getAllAsync<Budget>(`
    SELECT
      b.id, b.category_id, b.month, b.amount,
      c.name  AS category_name,
      c.icon  AS category_icon,
      c.color AS category_color
    FROM budgets b
    LEFT JOIN categories c ON c.id = b.category_id
    WHERE b.is_deleted = 0 AND b.month = ?
    ORDER BY b.category_id IS NULL DESC, c.name ASC
  `, [month]);

  const result: BudgetWithSpent[] = [];

  for (const budget of budgets) {
    let spent = 0;

    if (budget.category_id === null) {
      // Overall budget — sum all expenses this month
      const row = await db.getFirstAsync<{ total: number }>(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'expense' AND is_deleted = 0
          AND occurred_at >= ? AND occurred_at <= ?
      `, [monthStart, monthEnd]);
      spent = row?.total ?? 0;
    } else {
      // Per-category budget
      const row = await db.getFirstAsync<{ total: number }>(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'expense' AND is_deleted = 0
          AND category_id = ?
          AND occurred_at >= ? AND occurred_at <= ?
      `, [budget.category_id, monthStart, monthEnd]);
      spent = row?.total ?? 0;
    }

    result.push({
      ...budget,
      spent,
      remaining: budget.amount - spent,
      percentage: budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0,
    });
  }

  return result;
}

/** Returns all months that have at least one budget, most recent first. */
export async function getBudgetMonths(): Promise<string[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ month: string }>(`
    SELECT DISTINCT month FROM budgets
    WHERE is_deleted = 0
    ORDER BY month DESC
  `);
  return rows.map((r) => r.month);
}

export async function upsertBudget(params: {
  category_id: string | null;
  month: string;
  amount: number;
}): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Check if one already exists for this category+month
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM budgets WHERE category_id IS ? AND month = ? AND is_deleted = 0`,
    [params.category_id, params.month]
  );

  if (existing) {
    await db.runAsync(
      `UPDATE budgets SET amount = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
      [params.amount, now, existing.id]
    );
  } else {
    const id = uuid();
    await db.runAsync(
      `INSERT INTO budgets (id, category_id, month, amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, params.category_id, params.month, params.amount, now, now]
    );
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE budgets SET is_deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?`,
    [now, id]
  );
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}