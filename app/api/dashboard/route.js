import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import sql from '../../../lib/db';

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

const PROJECTION_CATEGORIES = new Set([
  'Entertainment',
  'Food & Drink',
  'Gas',
  'Groceries',
  'Shopping',
  'Home',
  'Personal',
  'Professional Services',
  'Travel',
]);

export async function GET(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Return list of all available months for the dropdown
    if (searchParams.get('months') === 'true') {
      const months = await sql`
        SELECT DISTINCT TO_CHAR(transaction_date::date, 'YYYY-MM') AS month
        FROM transactions
        WHERE user_id = ${userId}
        ORDER BY month DESC
      `;
      return NextResponse.json(months.map(r => r.month));
    }

    if (!month) {
      return NextResponse.json({ error: 'month parameter is required' }, { status: 400 });
    }

    const [year, mon] = month.split('-').map(Number);
    const start = `${month}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Spending by category for the selected month
    const byCategory = await sql`
      SELECT
        category,
        ROUND(-SUM(amount)::numeric, 2) AS total_spent
      FROM transactions
      WHERE
        transaction_date >= ${start}
        AND transaction_date <= ${end}
        AND user_id = ${userId}
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
      GROUP BY category
      ORDER BY total_spent DESC
    `;

    // Budgets for the selected month
    const budgets = await sql`
      SELECT category, monthly_target
      FROM monthly_budgets
      WHERE month = ${month} AND user_id = ${userId}
    `;

    const budgetMap = {};
    for (const b of budgets) {
      budgetMap[b.category] = b.monthly_target;
    }

    // Category colours
    const colours = await sql`
      SELECT name, colour FROM categories
      WHERE user_id = ${userId}
    `;

    const colourMap = {};
    for (const c of colours) {
      colourMap[c.name] = c.colour;
    }

    // Calculate projections
    const today = new Date();
    const isCurrentMonth = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const dayOfMonth = today.getDate();

    const categoryData = byCategory.map(row => {
      const totalSpent = parseFloat(row.total_spent);
      const shouldProject = isCurrentMonth && PROJECTION_CATEGORIES.has(row.category);
      let projected_spend = null;

      if (shouldProject && dayOfMonth > 0) {
        const dailyAverage = totalSpent / dayOfMonth;
        projected_spend = Math.round(dailyAverage * lastDay * 100) / 100;
      }

      return {
        ...row,
        total_spent: totalSpent,
        colour: colourMap[row.category] ?? '#d1d5db',
        monthly_target: budgetMap[row.category] ?? null,
        projected_spend,
      };
    });

    // Monthly trend — last 12 months
    const trend = await sql`
      SELECT
        TO_CHAR(transaction_date::date, 'YYYY-MM') AS month,
        ROUND(-SUM(amount)::numeric, 2) AS total_spent
      FROM transactions
      WHERE
        user_id = ${userId}
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
        AND transaction_date >= (NOW() - INTERVAL '12 months')::date::text
      GROUP BY TO_CHAR(transaction_date::date, 'YYYY-MM')
      ORDER BY month ASC
    `;

    const trendWithBudget = await Promise.all(trend.map(async row => {
      const budgetRows = await sql`
        SELECT SUM(monthly_target) AS total_budget
        FROM monthly_budgets
        WHERE month = ${row.month} AND user_id = ${userId}
      `;
      return {
        ...row,
        total_spent: parseFloat(row.total_spent),
        total_budget: parseFloat(budgetRows[0]?.total_budget ?? 0),
      };
    }));

    // Category trends — last 12 months
    const categoryTrends = await sql`
      SELECT
        TO_CHAR(transaction_date::date, 'YYYY-MM') AS month,
        category,
        ROUND(-SUM(amount)::numeric, 2) AS total_spent
      FROM transactions
      WHERE
        user_id = ${userId}
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
        AND transaction_date >= (NOW() - INTERVAL '12 months')::date::text
      GROUP BY TO_CHAR(transaction_date::date, 'YYYY-MM'), category
      ORDER BY month ASC
    `;

    const trendCategories = [...new Set(categoryTrends.map(r => r.category))].sort();
    const trendMonths = [...new Set(categoryTrends.map(r => r.month))].sort();

    const trendLookup = {};
    for (const row of categoryTrends) {
      if (!trendLookup[row.category]) trendLookup[row.category] = {};
      trendLookup[row.category][row.month] = parseFloat(row.total_spent);
    }

    return NextResponse.json({
      categoryData,
      monthlyTrend: trendWithBudget,
      categoryTrends: { months: trendMonths, categories: trendCategories, lookup: trendLookup },
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}