// app/api/reports/route.js

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
    const report = searchParams.get('report');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    switch (report) {

      // --- Top merchants by spend ---
      case 'top_merchants': {
        const rows = await sql`
          SELECT
            COALESCE(custom_description, description) AS merchant,
            COUNT(*) AS transaction_count,
            ROUND(-SUM(amount)::numeric, 2) AS total_spent
          FROM transactions
          WHERE user_id = ${userId}
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND transaction_date >= COALESCE(${start}, (NOW() - INTERVAL '12 months')::date::text)
            AND transaction_date <= COALESCE(${end}, NOW()::date::text)
          GROUP BY COALESCE(custom_description, description)
          ORDER BY total_spent DESC
          LIMIT 20
        `;
        return NextResponse.json(rows.map(r => ({ ...r, total_spent: parseFloat(r.total_spent) })));
      }

      // --- Biggest single transactions ---
      case 'biggest_transactions': {
        const rows = await sql`
          SELECT
            COALESCE(custom_description, description) AS merchant,
            category,
            transaction_date,
            ABS(amount) AS amount
          FROM transactions
          WHERE user_id = ${userId}
            AND amount < 0
            AND is_original_split != 1
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND transaction_date >= COALESCE(${start}, (NOW() - INTERVAL '12 months')::date::text)
            AND transaction_date <= COALESCE(${end}, NOW()::date::text)
          ORDER BY amount DESC
          LIMIT 20
        `;
        return NextResponse.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
      }

      // --- Average spend by category ---
      case 'category_averages': {
        const rows = await sql`
          SELECT
            category,
            ROUND(-SUM(amount)::numeric, 2) AS total_spent,
            COUNT(DISTINCT TO_CHAR(transaction_date::date, 'YYYY-MM')) AS months_active,
            ROUND((-SUM(amount) / COUNT(DISTINCT TO_CHAR(transaction_date::date, 'YYYY-MM')))::numeric, 2) AS monthly_avg,
            ROUND((-SUM(amount) / COUNT(DISTINCT TO_CHAR(transaction_date::date, 'IYYY-IW')))::numeric, 2) AS weekly_avg,
            ROUND((-SUM(amount) / COUNT(DISTINCT transaction_date))::numeric, 2) AS daily_avg
          FROM transactions
          WHERE user_id = ${userId}
            AND category IS NOT NULL
            AND category != ''
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND transaction_date >= COALESCE(${start}, (NOW() - INTERVAL '12 months')::date::text)
            AND transaction_date <= COALESCE(${end}, NOW()::date::text)
          GROUP BY category
          ORDER BY total_spent DESC
        `;
        return NextResponse.json(rows.map(r => ({
          ...r,
          total_spent: parseFloat(r.total_spent),
          monthly_avg: parseFloat(r.monthly_avg),
          weekly_avg: parseFloat(r.weekly_avg),
          daily_avg: parseFloat(r.daily_avg),
        })));
      }

      // --- Year over year comparison ---
      case 'year_over_year': {
        const currentYear = String(year ?? new Date().getFullYear());
        const prevYear = String(parseInt(currentYear) - 1);
        const rows = await sql`
          SELECT
            category,
            ROUND(-SUM(CASE WHEN TO_CHAR(transaction_date::date, 'YYYY') = ${currentYear} THEN amount ELSE 0 END)::numeric, 2) AS current_year,
            ROUND(-SUM(CASE WHEN TO_CHAR(transaction_date::date, 'YYYY') = ${prevYear} THEN amount ELSE 0 END)::numeric, 2) AS prev_year
          FROM transactions
          WHERE user_id = ${userId}
            AND category IS NOT NULL
            AND category != ''
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND TO_CHAR(transaction_date::date, 'YYYY') IN (${currentYear}, ${prevYear})
          GROUP BY category
          ORDER BY current_year DESC
        `;
        return NextResponse.json({
          rows: rows.map(r => ({
            ...r,
            current_year: parseFloat(r.current_year),
            prev_year: parseFloat(r.prev_year),
          })),
          currentYear,
          prevYear,
        });
      }

      // --- Monthly spend trend by category ---
      case 'category_trends': {
        const rows = await sql`
          SELECT
            TO_CHAR(transaction_date::date, 'YYYY-MM') AS month,
            category,
            ROUND(-SUM(amount)::numeric, 2) AS total_spent
          FROM transactions
          WHERE user_id = ${userId}
            AND category IS NOT NULL
            AND category != ''
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND transaction_date >= (NOW() - INTERVAL '12 months')::date::text
          GROUP BY TO_CHAR(transaction_date::date, 'YYYY-MM'), category
          ORDER BY month ASC, total_spent DESC
        `;
        return NextResponse.json(rows.map(r => ({ ...r, total_spent: parseFloat(r.total_spent) })));
      }

      // --- Savings rate ---
      case 'savings_rate': {
        const rows = await sql`
          SELECT
            TO_CHAR(transaction_date::date, 'YYYY-MM') AS month,
            ROUND(SUM(CASE WHEN amount > 0 AND category = 'Income' THEN amount ELSE 0 END)::numeric, 2) AS income,
            ROUND(-SUM(CASE WHEN category != 'Income' THEN amount ELSE 0 END)::numeric, 2) AS spending
          FROM transactions
          WHERE user_id = ${userId}
            AND transaction_date >= (NOW() - INTERVAL '12 months')::date::text
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND is_original_split != 1
          GROUP BY TO_CHAR(transaction_date::date, 'YYYY-MM')
          ORDER BY month ASC
        `;

        const withRate = rows.map(r => {
          const income = parseFloat(r.income);
          const spending = parseFloat(r.spending);
          return {
            ...r,
            income,
            spending,
            net: Math.round((income - spending) * 100) / 100,
            savings_rate: income > 0
              ? Math.round(((income - spending) / income) * 100 * 10) / 10
              : null,
          };
        });

        return NextResponse.json(withRate);
      }

      // --- Rolling averages ---
      case 'rolling_averages': {
        const rows = await sql`
          SELECT
            TO_CHAR(transaction_date::date, 'YYYY-MM') AS month,
            ROUND(-SUM(amount)::numeric, 2) AS total_spent
          FROM transactions
          WHERE user_id = ${userId}
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND transaction_date >= (NOW() - INTERVAL '12 months')::date::text
          GROUP BY TO_CHAR(transaction_date::date, 'YYYY-MM')
          ORDER BY month ASC
        `;

        const parsed = rows.map(r => ({ ...r, total_spent: parseFloat(r.total_spent) }));

        const withRolling = parsed.map((row, i) => {
          const last3 = parsed.slice(Math.max(0, i - 2), i + 1);
          const last12 = parsed.slice(Math.max(0, i - 11), i + 1);
          return {
            ...row,
            rolling_3: Math.round((last3.reduce((s, r) => s + r.total_spent, 0) / last3.length) * 100) / 100,
            rolling_12: Math.round((last12.reduce((s, r) => s + r.total_spent, 0) / last12.length) * 100) / 100,
          };
        });

        return NextResponse.json(withRolling);
      }

      // --- Budget variance ---
      case 'budget_variance': {
        const rows = await sql`
          SELECT
            t.category,
            TO_CHAR(t.transaction_date::date, 'YYYY-MM') AS month,
            ROUND(-SUM(t.amount)::numeric, 2) AS actual,
            COALESCE(mb.monthly_target, 0) AS budget
          FROM transactions t
          LEFT JOIN monthly_budgets mb
            ON mb.category = t.category
            AND mb.month = TO_CHAR(t.transaction_date::date, 'YYYY-MM')
            AND mb.user_id = ${userId}
          WHERE t.user_id = ${userId}
            AND t.category IS NOT NULL
            AND t.category != ''
            AND t.category != 'Transfer'
            AND t.category != 'Withdrawal'
            AND t.category != 'Income'
            AND t.is_original_split != 1
            AND t.transaction_date >= (NOW() - INTERVAL '6 months')::date::text
          GROUP BY t.category, TO_CHAR(t.transaction_date::date, 'YYYY-MM'), mb.monthly_target
          ORDER BY t.category, month
        `;

        const byCategory = {};
        for (const row of rows) {
          if (!byCategory[row.category]) {
            byCategory[row.category] = { category: row.category, months: [], avg_variance: 0 };
          }
          const actual = parseFloat(row.actual);
          const budget = parseFloat(row.budget);
          byCategory[row.category].months.push({
            month: row.month,
            actual,
            budget,
            variance: Math.round((actual - budget) * 100) / 100,
          });
        }

        for (const cat of Object.values(byCategory)) {
          const withBudget = cat.months.filter(m => m.budget > 0);
          cat.avg_variance = withBudget.length > 0
            ? Math.round((withBudget.reduce((s, m) => s + m.variance, 0) / withBudget.length) * 100) / 100
            : null;
        }

        return NextResponse.json(Object.values(byCategory).sort((a, b) => (b.avg_variance ?? 0) - (a.avg_variance ?? 0)));
      }

      // --- Full transaction export ---
      case 'export': {
        const rows = await sql`
          SELECT
            transaction_date,
            post_date,
            COALESCE(custom_description, description) AS description,
            category,
            type,
            amount,
            memo,
            account
          FROM transactions
          WHERE user_id = ${userId}
            AND transaction_date >= COALESCE(${start}, '2000-01-01')
            AND transaction_date <= COALESCE(${end}, NOW()::date::text)
          ORDER BY transaction_date DESC
        `;
        return NextResponse.json(rows);
      }

      // --- Recurring transaction detection ---
      case 'recurring': {
        const allTx = await sql`
          SELECT
            COALESCE(custom_description, description) AS merchant,
            transaction_date,
            ABS(amount) AS amount,
            category
          FROM transactions
          WHERE user_id = ${userId}
            AND amount < 0
            AND is_original_split != 1
            AND transaction_date >= (NOW() - INTERVAL '13 months')::date::text
          ORDER BY merchant, transaction_date ASC
        `;

        const byMerchant = {};
        for (const tx of allTx) {
          if (!byMerchant[tx.merchant]) byMerchant[tx.merchant] = [];
          byMerchant[tx.merchant].push({ ...tx, amount: parseFloat(tx.amount) });
        }

        const recurring = [];

        for (const [merchant, txs] of Object.entries(byMerchant)) {
          if (txs.length < 2) continue;

          const gaps = [];
          for (let i = 1; i < txs.length; i++) {
            const a = new Date(txs[i - 1].transaction_date);
            const b = new Date(txs[i].transaction_date);
            gaps.push(Math.round((b - a) / (1000 * 60 * 60 * 24)));
          }

          const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
          const maxDeviation = Math.max(...gaps.map(g => Math.abs(g - avgGap)));

          let interval = null;
          if (avgGap >= 5 && avgGap <= 9 && maxDeviation <= 3) interval = 'weekly';
          else if (avgGap >= 25 && avgGap <= 35 && maxDeviation <= 5) interval = 'monthly';
          else if (avgGap >= 340 && avgGap <= 390 && maxDeviation <= 15) interval = 'annual';

          if (!interval) continue;

          const avgAmount = txs.reduce((s, t) => s + t.amount, 0) / txs.length;
          const amountVariance = Math.max(...txs.map(t => Math.abs(t.amount - avgAmount)));

          const lastDate = new Date(txs[txs.length - 1].transaction_date);
          const nextDate = new Date(lastDate);
          nextDate.setDate(nextDate.getDate() + Math.round(avgGap));

          recurring.push({
            merchant,
            category: txs[0].category,
            interval,
            avg_amount: Math.round(avgAmount * 100) / 100,
            amount_variance: Math.round(amountVariance * 100) / 100,
            occurrences: txs.length,
            last_date: txs[txs.length - 1].transaction_date,
            next_expected: nextDate.toISOString().split('T')[0],
            fixed_amount: amountVariance < 1,
          });
        }

        const order = { weekly: 0, monthly: 1, annual: 2 };
        recurring.sort((a, b) => order[a.interval] - order[b.interval] || b.avg_amount - a.avg_amount);

        return NextResponse.json(recurring);
      }

      // --- Income by month ---
      case 'income_by_month': {
        const rows = await sql`
          SELECT
            TO_CHAR(transaction_date::date, 'YYYY-MM') AS month,
            ROUND(SUM(amount)::numeric, 2) AS total_income,
            COUNT(*) AS transaction_count
          FROM transactions
          WHERE user_id = ${userId}
            AND amount > 0
            AND category = 'Income'
            AND transaction_date >= (NOW() - INTERVAL '12 months')::date::text
          GROUP BY TO_CHAR(transaction_date::date, 'YYYY-MM')
          ORDER BY month ASC
        `;
        return NextResponse.json(rows.map(r => ({ ...r, total_income: parseFloat(r.total_income) })));
      }

      // --- Income by source ---
      case 'income_by_source': {
        const rows = await sql`
          SELECT
            COALESCE(custom_description, description) AS source,
            ROUND(SUM(amount)::numeric, 2) AS amount,
            MAX(transaction_date) AS transaction_date,
            COUNT(*) AS transaction_count
          FROM transactions
          WHERE user_id = ${userId}
            AND amount > 0
            AND category = 'Income'
            AND transaction_date >= COALESCE(${start}, (NOW() - INTERVAL '12 months')::date::text)
            AND transaction_date <= COALESCE(${end}, NOW()::date::text)
          GROUP BY COALESCE(custom_description, description)
          ORDER BY amount DESC
        `;
        return NextResponse.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
      }

      // --- Income for a specific month ---
      case 'income_for_month': {
        const rows = await sql`
          SELECT
            ROUND(SUM(amount)::numeric, 2) AS total_income
          FROM transactions
          WHERE user_id = ${userId}
            AND amount > 0
            AND category = 'Income'
            AND TO_CHAR(transaction_date::date, 'YYYY-MM') = ${month}
        `;
        return NextResponse.json({ total_income: parseFloat(rows[0]?.total_income ?? 0) });
      }

      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

  } catch (error) {
    console.error('GET /api/reports error:', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}