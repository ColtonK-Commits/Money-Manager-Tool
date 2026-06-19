// app/api/reports/route.js

import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const report = searchParams.get('report');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    switch (report) {

      // --- Top merchants by spend ---
      case 'top_merchants': {
        const rows = db.prepare(`
SELECT
            COALESCE(custom_description, description) AS merchant,
            COUNT(*) AS transaction_count,
            ROUND(-SUM(amount), 2) AS total_spent
          FROM transactions
          WHERE category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND transaction_date >= COALESCE(?, DATE('now', '-12 months'))
            AND transaction_date <= COALESCE(?, DATE('now'))
          GROUP BY COALESCE(custom_description, description)
          ORDER BY total_spent DESC
          LIMIT 20
        `).all(start, end);
        return NextResponse.json(rows);
      }

      // --- Biggest single transactions ---
      case 'biggest_transactions': {
        const rows = db.prepare(`
          SELECT
            COALESCE(custom_description, description) AS merchant,
            category,
            transaction_date,
            ABS(amount) AS amount
          FROM transactions
          WHERE amount < 0
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND transaction_date >= COALESCE(?, DATE('now', '-12 months'))
            AND transaction_date <= COALESCE(?, DATE('now'))
          ORDER BY amount DESC
          LIMIT 20
        `).all(start, end);
        return NextResponse.json(rows);
      }

      // --- Average spend by category ---
      case 'category_averages': {
        const rows = db.prepare(`
          SELECT
            category,
            ROUND(-SUM(amount), 2) AS total_spent,
            COUNT(DISTINCT strftime('%Y-%m', transaction_date)) AS months_active,
            ROUND(-SUM(amount) / COUNT(DISTINCT strftime('%Y-%m', transaction_date)), 2) AS monthly_avg,
            ROUND(-SUM(amount) / COUNT(DISTINCT strftime('%Y-%W', transaction_date)), 2) AS weekly_avg,
            ROUND(-SUM(amount) / COUNT(DISTINCT transaction_date), 2) AS daily_avg
          FROM transactions
          WHERE category IS NOT NULL
            AND category != ''
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND transaction_date >= COALESCE(?, DATE('now', '-12 months'))
            AND transaction_date <= COALESCE(?, DATE('now'))
          GROUP BY category
          ORDER BY total_spent DESC
        `).all(start, end);
        return NextResponse.json(rows);
      }

      // --- Year over year comparison ---
      case 'year_over_year': {
        const currentYear = year ?? new Date().getFullYear();
        const prevYear = currentYear - 1;
        const rows = db.prepare(`
          SELECT
            category,
            ROUND(-SUM(CASE WHEN strftime('%Y', transaction_date) = ? THEN amount ELSE 0 END), 2) AS current_year,
            ROUND(-SUM(CASE WHEN strftime('%Y', transaction_date) = ? THEN amount ELSE 0 END), 2) AS prev_year
          FROM transactions
          WHERE category IS NOT NULL
            AND category != ''
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND strftime('%Y', transaction_date) IN (?, ?)
          GROUP BY category
          ORDER BY current_year DESC
        `).all(String(currentYear), String(prevYear), String(currentYear), String(prevYear));
        return NextResponse.json({ rows, currentYear, prevYear });
      }

      // --- Monthly spend trend by category ---
      case 'category_trends': {
        const rows = db.prepare(`
          SELECT
            strftime('%Y-%m', transaction_date) AS month,
            category,
            ROUND(-SUM(amount), 2) AS total_spent
          FROM transactions
          WHERE category IS NOT NULL
            AND category != ''
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND transaction_date >= DATE('now', '-12 months')
          GROUP BY month, category
          ORDER BY month ASC, total_spent DESC
        `).all();
        return NextResponse.json(rows);
      }

      // --- Savings rate ---
      case 'savings_rate': {
        const rows = db.prepare(`
          SELECT
            strftime('%Y-%m', transaction_date) AS month,
            ROUND(SUM(CASE WHEN amount > 0 AND category = 'Income' THEN amount ELSE 0 END), 2) AS income,
            ROUND(-SUM(CASE WHEN category != 'Income' THEN amount ELSE 0 END), 2) AS spending
          FROM transactions
          WHERE transaction_date >= DATE('now', '-12 months')
            AND category != 'Transfer'
            AND category != 'Withdrawal'
            AND is_original_split != 1
          GROUP BY month
          ORDER BY month ASC
        `).all();

        const withRate = rows.map(r => ({
          ...r,
          net: Math.round((r.income - r.spending) * 100) / 100,
          savings_rate: r.income > 0
            ? Math.round(((r.income - r.spending) / r.income) * 100 * 10) / 10
            : null,
        }));

        return NextResponse.json(withRate);
      }

      // --- Rolling averages ---
      case 'rolling_averages': {
        const rows = db.prepare(`
          SELECT
            strftime('%Y-%m', transaction_date) AS month,
            ROUND(-SUM(amount), 2) AS total_spent
          FROM transactions
          WHERE category != 'Transfer'
            AND category != 'Withdrawal'
            AND category != 'Income'
            AND is_original_split != 1
            AND transaction_date >= DATE('now', '-12 months')
          GROUP BY month
          ORDER BY month ASC
        `).all();

        // Calculate 3-month and 12-month rolling averages
        const withRolling = rows.map((row, i) => {
          const last3 = rows.slice(Math.max(0, i - 2), i + 1);
          const last12 = rows.slice(Math.max(0, i - 11), i + 1);
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
        const rows = db.prepare(`
          SELECT
            t.category,
            strftime('%Y-%m', t.transaction_date) AS month,
            ROUND(-SUM(t.amount), 2) AS actual,
            COALESCE(mb.monthly_target, 0) AS budget
          FROM transactions t
          LEFT JOIN monthly_budgets mb
            ON mb.category = t.category
            AND mb.month = strftime('%Y-%m', t.transaction_date)
          WHERE t.category IS NOT NULL
            AND t.category != ''
            AND t.category != 'Transfer'
            AND t.category != 'Withdrawal'
            AND t.category != 'Income'
            AND t.is_original_split != 1
            AND t.transaction_date >= DATE('now', '-6 months')
          GROUP BY t.category, month
          ORDER BY t.category, month
        `).all();

        // Group by category and calculate average variance
        const byCategory = {};
        for (const row of rows) {
          if (!byCategory[row.category]) {
            byCategory[row.category] = { category: row.category, months: [], avg_variance: 0 };
          }
          byCategory[row.category].months.push({
            month: row.month,
            actual: row.actual,
            budget: row.budget,
            variance: Math.round((row.actual - row.budget) * 100) / 100,
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

      // --- Full transaction export (for Excel/PDF) ---
      case 'export': {
        const rows = db.prepare(`
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
          WHERE transaction_date >= COALESCE(?, '2000-01-01')
            AND transaction_date <= COALESCE(?, DATE('now'))
          ORDER BY transaction_date DESC
        `).all(start, end);
        return NextResponse.json(rows);
      }

      // --- Recurring transaction detection ---
      case 'recurring': {
        // Get all transactions grouped by merchant, ordered by date
        const allTx = db.prepare(`
          SELECT
            COALESCE(custom_description, description) AS merchant,
            transaction_date,
            ABS(amount) AS amount,
            category
          FROM transactions
          WHERE amount < 0
            AND transaction_date >= DATE('now', '-13 months')
          ORDER BY merchant, transaction_date ASC
        `).all();

        // Group by merchant
        const byMerchant = {};
        for (const tx of allTx) {
          if (!byMerchant[tx.merchant]) byMerchant[tx.merchant] = [];
          byMerchant[tx.merchant].push(tx);
        }

        const recurring = [];

        for (const [merchant, txs] of Object.entries(byMerchant)) {
          if (txs.length < 2) continue;

          // Calculate gaps in days between consecutive transactions
          const gaps = [];
          for (let i = 1; i < txs.length; i++) {
            const a = new Date(txs[i - 1].transaction_date);
            const b = new Date(txs[i].transaction_date);
            gaps.push(Math.round((b - a) / (1000 * 60 * 60 * 24)));
          }

          const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
          const maxDeviation = Math.max(...gaps.map(g => Math.abs(g - avgGap)));

          // Detect interval — allow some tolerance
          let interval = null;
          if (avgGap >= 5 && avgGap <= 9 && maxDeviation <= 3) interval = 'weekly';
          else if (avgGap >= 25 && avgGap <= 35 && maxDeviation <= 5) interval = 'monthly';
          else if (avgGap >= 340 && avgGap <= 390 && maxDeviation <= 15) interval = 'annual';

          if (!interval) continue;

          // Calculate average amount
          const avgAmount = txs.reduce((s, t) => s + t.amount, 0) / txs.length;
          const amountVariance = Math.max(...txs.map(t => Math.abs(t.amount - avgAmount)));

          // Calculate next expected date
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

        // Sort by interval then amount
        const order = { weekly: 0, monthly: 1, annual: 2 };
        recurring.sort((a, b) => order[a.interval] - order[b.interval] || b.avg_amount - a.avg_amount);

        return NextResponse.json(recurring);
      }

      // --- Income by month ---
      case 'income_by_month': {
        const rows = db.prepare(`
          SELECT
            strftime('%Y-%m', transaction_date) AS month,
            ROUND(SUM(amount), 2) AS total_income,
            COUNT(*) AS transaction_count
          FROM transactions
          WHERE amount > 0
            AND category = 'Income'
            AND transaction_date >= DATE('now', '-12 months')
          GROUP BY month
          ORDER BY month ASC
        `).all();
        return NextResponse.json(rows);
      }

      // --- Income by source ---
      case 'income_by_source': {
        const rows = db.prepare(`
          SELECT
            strftime('%Y-%m', transaction_date) AS month,
            COALESCE(custom_description, description) AS source,
            ROUND(SUM(amount), 2) AS amount,
            transaction_date
          FROM transactions
          WHERE amount > 0
            AND category = 'Income'
            AND transaction_date >= COALESCE(?, DATE('now', '-12 months'))
            AND transaction_date <= COALESCE(?, DATE('now'))
          ORDER BY transaction_date DESC
        `).all(start, end);
        return NextResponse.json(rows);
      }

      // --- Income for a specific month (for budget page) ---
      case 'income_for_month': {
        const row = db.prepare(`
          SELECT
            ROUND(SUM(amount), 2) AS total_income
          FROM transactions
          WHERE amount > 0
            AND category = 'Income'
            AND strftime('%Y-%m', transaction_date) = ?
        `).get(month);
        return NextResponse.json({ total_income: row?.total_income ?? 0 });
      }

      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

  } catch (error) {
    console.error('GET /api/reports error:', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}