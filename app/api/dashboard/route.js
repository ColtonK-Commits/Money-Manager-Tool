// app/api/dashboard/route.js

import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

// Categories that should have end-of-month projections
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
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Return list of all available months for the dropdown
    if (searchParams.get('months') === 'true') {
      const months = db.prepare(`
        SELECT DISTINCT strftime('%Y-%m', transaction_date) AS month
        FROM transactions
        ORDER BY month DESC
      `).all().map(r => r.month);
      return NextResponse.json(months);
    }

    if (!month) {
      return NextResponse.json({ error: 'month parameter is required' }, { status: 400 });
    }

    // Start and end of the selected month
    const [year, mon] = month.split('-').map(Number);
    const start = `${month}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Spending by category for the selected month
    const byCategory = db.prepare(`
      SELECT
        category,
        ROUND(SUM(ABS(amount)), 2) AS total_spent
      FROM transactions
      WHERE
        transaction_date >= ?
        AND transaction_date <= ?
        AND amount < 0
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
      GROUP BY category
      ORDER BY total_spent DESC
    `).all(start, end);

    // Budgets for the selected month from monthly_budgets
    const budgets = db.prepare(`
      SELECT category, monthly_target
      FROM monthly_budgets
      WHERE month = ?
    `).all(month);

    const budgetMap = {};
    for (const b of budgets) {
      budgetMap[b.category] = b.monthly_target;
    }

    // Category colours
    const colours = db.prepare(`
      SELECT name, colour FROM categories
    `).all();

    const colourMap = {};
    for (const c of colours) {
      colourMap[c.name] = c.colour;
    }

    // Calculate projection for eligible categories
    // Only project for the current month — past months are complete
    const today = new Date();
    const isCurrentMonth = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const dayOfMonth = today.getDate();

    const categoryData = byCategory.map(row => {
      const shouldProject = isCurrentMonth && PROJECTION_CATEGORIES.has(row.category);
      let projected_spend = null;

      if (shouldProject && dayOfMonth > 0) {
        const dailyAverage = row.total_spent / dayOfMonth;
        projected_spend = Math.round(dailyAverage * lastDay * 100) / 100;
      }

      return {
        ...row,
        colour: colourMap[row.category] ?? '#d1d5db',
        monthly_target: budgetMap[row.category] ?? null,
        projected_spend,
      };
    });

    // Monthly trend — last 12 months actual spending + budget
    const trend = db.prepare(`
      SELECT
        strftime('%Y-%m', transaction_date) AS month,
        ROUND(SUM(ABS(amount)), 2) AS total_spent
      FROM transactions
      WHERE
        amount < 0
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND transaction_date >= DATE('now', '-12 months')
      GROUP BY month
      ORDER BY month ASC
    `).all();

    const trendWithBudget = trend.map(row => {
      const monthBudgets = db.prepare(`
        SELECT SUM(monthly_target) AS total_budget
        FROM monthly_budgets
        WHERE month = ?
      `).get(row.month);

      return {
        ...row,
        total_budget: monthBudgets?.total_budget ?? 0,
      };
    });

// Category trends — spending per category per month for last 12 months
    const categoryTrends = db.prepare(`
      SELECT
        strftime('%Y-%m', transaction_date) AS month,
        category,
        ROUND(SUM(ABS(amount)), 2) AS total_spent
      FROM transactions
      WHERE
        amount < 0
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND transaction_date >= DATE('now', '-12 months')
      GROUP BY month, category
      ORDER BY month ASC
    `).all();

    // Get all unique categories that appear in the trends
    const trendCategories = [...new Set(categoryTrends.map(r => r.category))].sort();

    // Get all unique months in the trends
    const trendMonths = [...new Set(categoryTrends.map(r => r.month))].sort();

    // Build a lookup: { 'Groceries': { '2026-04': 312.50, '2026-05': 287.00 } }
    const trendLookup = {};
    for (const row of categoryTrends) {
      if (!trendLookup[row.category]) trendLookup[row.category] = {};
      trendLookup[row.category][row.month] = row.total_spent;
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