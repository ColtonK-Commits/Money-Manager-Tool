import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import sql from '../../../lib/db';

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
      const months = await sql`
        SELECT DISTINCT month FROM monthly_budgets
        WHERE user_id = ${userId}
        ORDER BY month DESC
      `;
      return NextResponse.json(months.map(r => r.month));
    }

    if (!month) {
      return NextResponse.json({ error: 'month parameter is required' }, { status: 400 });
    }

    // Get all known categories for this user
    const allCategories = await sql`
      SELECT name AS category FROM categories
      WHERE user_id = ${userId}
        AND name != 'Transfer' AND name != 'Income'
      UNION
      SELECT DISTINCT category FROM transactions
      WHERE user_id = ${userId}
        AND category IS NOT NULL AND category != ''
        AND category != 'Transfer' AND category != 'Income' AND category != 'Withdrawal'
      ORDER BY category
    `;

    // Get budgets for the requested month
    let monthBudgets = await sql`
      SELECT category, monthly_target
      FROM monthly_budgets
      WHERE month = ${month} AND user_id = ${userId}
    `;

    // If no budgets exist for this month, auto-fill from previous month
    if (monthBudgets.length === 0) {
      const [year, mon] = month.split('-').map(Number);
      let prevYear = year;
      let prevMon = mon - 1;
      if (prevMon === 0) { prevMon = 12; prevYear--; }
      const prevMonth = `${prevYear}-${String(prevMon).padStart(2, '0')}`;

      const prevBudgets = await sql`
        SELECT category, monthly_target
        FROM monthly_budgets
        WHERE month = ${prevMonth} AND user_id = ${userId}
      `;

      for (const b of prevBudgets) {
        await sql`
          INSERT INTO monthly_budgets (category, month, monthly_target, user_id)
          VALUES (${b.category}, ${month}, ${b.monthly_target}, ${userId})
          ON CONFLICT (category, month, user_id) DO NOTHING
        `;
      }

      monthBudgets = await sql`
        SELECT category, monthly_target
        FROM monthly_budgets
        WHERE month = ${month} AND user_id = ${userId}
      `;
    }

    const budgetMap = {};
    for (const b of monthBudgets) {
      budgetMap[b.category] = b.monthly_target;
    }

    // 30-day spending for display
    const spending30 = await sql`
      SELECT
        category,
        ROUND(-SUM(amount)::numeric, 2) AS total_spent
      FROM transactions
      WHERE
        TO_CHAR(transaction_date::date, 'YYYY-MM') = ${month}
        AND user_id = ${userId}
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
      GROUP BY category
    `;

    const spendingMap = {};
    for (const row of spending30) {
      spendingMap[row.category] = parseFloat(row.total_spent);
    }

    // 90-day suggestion
    const spending90 = await sql`
      SELECT
        category,
        ROUND(-SUM(amount)::numeric, 2) AS total_spent,
        MIN(transaction_date) AS earliest_date
      FROM transactions
      WHERE
        transaction_date >= (NOW() - INTERVAL '90 days')::date::text
        AND user_id = ${userId}
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
      GROUP BY category
    `;

    const suggestionMap = {};
    for (const row of spending90) {
      const earliest = new Date(row.earliest_date);
      const today = new Date();
      const daysOfData = Math.round((today - earliest) / (1000 * 60 * 60 * 24));
      if (daysOfData >= 30) {
        const dailyAverage = parseFloat(row.total_spent) / daysOfData;
        suggestionMap[row.category] = Math.round(dailyAverage * 30 * 100) / 100;
      }
    }

    const result = allCategories.map(row => ({
      category: row.category,
      monthly_target: budgetMap[row.category] ?? null,
      suggested_target: suggestionMap[row.category] ?? null,
      spent_this_month: spendingMap[row.category] ?? 0,
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

    await sql`
      INSERT INTO monthly_budgets (category, month, monthly_target, user_id)
      VALUES (${category}, ${month}, ${monthly_target}, ${userId})
      ON CONFLICT (category, month, user_id) DO UPDATE SET monthly_target = EXCLUDED.monthly_target
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/budgets error:', error);
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });
  }
}