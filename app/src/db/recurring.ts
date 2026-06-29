/**
 * All database operations for recurring templates.
 */
import { getDatabase } from "./index";

export interface RecurringTemplate {
  id: string;
  name: string;
  type: "expense" | "income";
  account_id: string | null;
  category_id: string | null;
  amount: number;
  currency: string;
  day_of_month: number;
  is_active: number;
  // joined fields
  account_name: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
}

export interface UpcomingReminder {
  template: RecurringTemplate;
  due_date: string;       // YYYY-MM-DD
  days_until: number;     // negative = overdue
  is_logged: boolean;     // true if a transaction already exists this month
}

export async function getRecurringTemplates(): Promise<RecurringTemplate[]> {
  const db = getDatabase();
  return await db.getAllAsync<RecurringTemplate>(`
    SELECT
      r.*,
      a.name  AS account_name,
      c.name  AS category_name,
      c.icon  AS category_icon,
      c.color AS category_color
    FROM recurring_templates r
    LEFT JOIN accounts   a ON a.id = r.account_id
    LEFT JOIN categories c ON c.id = r.category_id
    WHERE r.is_deleted = 0
    ORDER BY r.day_of_month ASC, r.name ASC
  `);
}

/**
 * Returns upcoming reminders for the current month, plus any overdue
 * ones from last month that haven't been logged yet.
 */
export async function getUpcomingReminders(): Promise<UpcomingReminder[]> {
  const db = getDatabase();
  const templates = await getRecurringTemplates();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const year  = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based

  const reminders: UpcomingReminder[] = [];

  for (const t of templates) {
    if (!t.is_active) continue;

    // Clamp day to last day of month (e.g. day 31 in February → 28/29)
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(t.day_of_month, lastDay);
    const due = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const daysUntil = Math.ceil(
      (new Date(due).getTime() - new Date(today).getTime()) / 86400000
    );

    // Check if already logged this month (transaction within same month
    // matching this template's account + category + amount)
    const existing = await db.getFirstAsync<{ count: number }>(`
      SELECT COUNT(*) as count FROM transactions
      WHERE is_deleted = 0
        AND type = ?
        AND account_id = ?
        AND category_id = ?
        AND amount = ?
        AND occurred_at >= ? AND occurred_at <= ?
    `, [
      t.type,
      t.account_id,
      t.category_id,
      t.amount,
      `${year}-${String(month).padStart(2, "0")}-01`,
      `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    ]);

    reminders.push({
      template: t,
      due_date: due,
      days_until: daysUntil,
      is_logged: (existing?.count ?? 0) > 0,
    });
  }

  // Sort: overdue first, then by due date
  return reminders.sort((a, b) => a.days_until - b.days_until);
}

export async function createRecurringTemplate(params: {
  name: string;
  type: "expense" | "income";
  account_id: string | null;
  category_id: string | null;
  amount: number;
  day_of_month: number;
}): Promise<string> {
  const db = getDatabase();
  const id  = uuid();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO recurring_templates
       (id, name, type, account_id, category_id, amount, currency, day_of_month, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.name, params.type, params.account_id, params.category_id,
     params.amount, "EUR", params.day_of_month, now, now]
  );
  return id;
}

export async function toggleRecurringTemplate(id: string, is_active: boolean): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE recurring_templates SET is_active = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
    [is_active ? 1 : 0, now, id]
  );
}

export async function deleteRecurringTemplate(id: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE recurring_templates SET is_deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?`,
    [now, id]
  );
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}