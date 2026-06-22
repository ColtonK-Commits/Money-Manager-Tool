import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Return list of all available months for the dropdown
    if (searchParams.get('months') === 'true') {
      const months = db.prepare(`
        SELECT DISTINCT month FROM monthly_budgets
        WHERE user_id = ?
        ORDER BY month DESC
      `).all(userId).map(r => r.month);
      return NextResponse.json(months);
    }

    if (!month) {
      return NextResponse.json({ error: 'month parameter is required' }, { status: 400 });
    }

    // Get all known categories for this user
    const allCategories = db.prepare(`
      SELECT name AS category FROM categories
      WHERE user_id = ?
        AND name != 'Transfer' AND name != 'Income'
      UNION
      SELECT DISTINCT category FROM transactions
      WHERE user_id = ?
        AND category IS NOT NULL AND category != ''
        AND category != 'Transfer' AND category != 'Income' AND category != 'Withdrawal'
      ORDER BY category
    `).all(userId, userId).map(r => r.category);

    // Get budgets for the requested month
    let monthBudgets = db.prepare(`
      SELECT category, monthly_target
      FROM monthly_budgets
      WHERE month = ? AND user_id = ?
    `).all(month, userId);

    // If no budgets exist for this month, auto-fill from previous month
    if (monthBudgets.length === 0) {
      const [year, mon] = month.split('-').map(Number);
      let prevYear = year;
      let prevMon = mon - 1;
      if (prevMon === 0) { prevMon = 12; prevYear--; }
      const prevMonth = `${prevYear}-${String(prevMon).padStart(2, '0')}`;

      const prevBudgets = db.prepare(`
        SELECT category, monthly_target
        FROM monthly_budgets
        WHERE month = ? AND user_id = ?
      `).all(prevMonth, userId);

      const insert = db.prepare(`
        INSERT OR IGNORE INTO monthly_budgets (category, month, monthly_target, user_id)
        VALUES (?, ?, ?, ?)
      `);
      const insertMany = db.transaction(() => {
        for (const b of prevBudgets) {
          insert.run(b.category, month, b.monthly_target, userId);
        }
      });
      insertMany();

      monthBudgets = db.prepare(`
        SELECT category, monthly_target
        FROM monthly_budgets
        WHERE month = ? AND user_id = ?
      `).all(month, userId);
    }

    const budgetMap = {};
    for (const b of monthBudgets) {
      budgetMap[b.category] = b.monthly_target;
    }

    // 30-day spending for display (corrected calculation)
    const spending30 = db.prepare(`
      SELECT
        category,
        ROUND(-SUM(amount), 2) AS total_spent
      FROM transactions
      WHERE
        strftime('%Y-%m', transaction_date) = ?
        AND user_id = ?
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
      GROUP BY category
    `).all(month, userId);

    const spendingMap = {};
    for (const row of spending30) {
      spendingMap[row.category] = row.total_spent;
    }

    // 90-day suggestion (corrected calculation)
    const spending90 = db.prepare(`
      SELECT
        category,
        ROUND(-SUM(amount), 2) AS total_spent,
        MIN(transaction_date) AS earliest_date
      FROM transactions
      WHERE
        transaction_date >= DATE('now', '-90 days')
        AND user_id = ?
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
      GROUP BY category
    `).all(userId);

    const suggestionMap = {};
    for (const row of spending90) {
      const earliest = new Date(row.earliest_date);
      const today = new Date();
      const daysOfData = Math.round((today - earliest) / (1000 * 60 * 60 * 24));
      if (daysOfData >= 30) {
        const dailyAverage = row.total_spent / daysOfData;
        suggestionMap[row.category] = Math.round(dailyAverage * 30 * 100) / 100;
      }
    }

    const result = allCategories.map(category => ({
      category,
      monthly_target: budgetMap[category] ?? null,
      suggested_target: suggestionMap[category] ?? null,
      spent_this_month: spendingMap[category] ?? 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/budgets error:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { category, monthly_target, month } = await request.json();

    if (!category || monthly_target === undefined || !month) {
      return NextResponse.json({ error: 'category, monthly_target and month are required' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO monthly_budgets (category, month, monthly_target, user_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(category, month, user_id) DO UPDATE SET monthly_target = excluded.monthly_target
    `).run(category, month, monthly_target, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/budgets error:', error);
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });
  }
}