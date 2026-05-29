// migrations/backfill-monthly-budgets.mjs

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

// The baseline budgets to backfill
const budgets = [
  { category: 'Bills & Utilities', monthly_target: 25.0 },
  { category: 'Entertainment',     monthly_target: 100.0 },
  { category: 'Fees & Adjustments',monthly_target: 5.0 },
  { category: 'Food & Drink',      monthly_target: 600.0 },
  { category: 'Gas',               monthly_target: 0.0 },
  { category: 'Groceries',         monthly_target: 300.0 },
  { category: 'Shopping',          monthly_target: 150.0 },
  { category: 'Home',              monthly_target: 50.0 },
  { category: 'Personal',          monthly_target: 50.0 },
  { category: 'Professional Services', monthly_target: 40.0 },
  { category: 'Travel',            monthly_target: 400.0 },
];

// Generate all months from 2023-05 to 2026-05
function generateMonths(start, end) {
  const months = [];
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

const months = generateMonths('2023-05', '2026-05');

const insert = db.prepare(`
  INSERT OR IGNORE INTO monthly_budgets (category, month, monthly_target)
  VALUES (?, ?, ?)
`);

const insertMany = db.transaction(() => {
  for (const month of months) {
    for (const budget of budgets) {
      insert.run(budget.category, month, budget.monthly_target);
    }
  }
});

insertMany();

console.log(`✅ Backfilled ${months.length} months × ${budgets.length} categories = ${months.length * budgets.length} rows`);
db.close();