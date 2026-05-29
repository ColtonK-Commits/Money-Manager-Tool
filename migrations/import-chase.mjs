// migrations/import-chase.mjs

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

const ACCOUNT_ID = 'CHASE-CREDIT-MANUAL';

function mapCategory(chaseCategory) {
  const c = (chaseCategory ?? '').trim();

  // Direct matches
  if (c === 'Food & Drink') return 'Food & Drink';
  if (c === 'Groceries') return 'Groceries';
  if (c === 'Gas') return 'Gas';
  if (c === 'Entertainment') return 'Entertainment';
  if (c === 'Shopping') return 'Shopping';
  if (c === 'Bills & Utilities') return 'Bills & Utilities';
  if (c === 'Travel') return 'Travel';
  if (c === 'Personal') return 'Personal';
  if (c === 'Fees & Adjustments') return 'Fees & Adjustments';
  if (c === 'Professional Services') return 'Professional Services';
  if (c === 'Gifts') return 'Gifts';

  // Remapped
  if (c === 'Accomodation') return 'Accommodation';
  if (c === 'Transportation') return 'Transportation';
  if (c === 'Health & Wellness') return 'Personal';
  if (c === 'Gifts & Donations') return 'Gifts';
  if (c === 'Clothes') return 'Clothes';
  if (c === 'Commute') return 'Commute';
  if (c === 'Visa Insurance') return 'Personal';

  return null;
}

function parseAmount(str) {
  if (!str || str.trim() === '') return null;
  const cleaned = str.replace(/[$,\s]/g, '');
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1));
  }
  return parseFloat(cleaned);
}

function parseDate(str) {
  const [month, day, year] = str.trim().split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseCsvLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cols.push(current.trim());
  return cols;
}

const csvPath = path.join(__dirname, '..', 'chase-credit.csv');
if (!fs.existsSync(csvPath)) {
  console.error('❌ chase-credit.csv not found in project root');
  process.exit(1);
}

const lines = fs.readFileSync(csvPath, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0);

const dataLines = lines.slice(1);

const insert = db.prepare(`
  INSERT INTO transactions
    (transaction_date, post_date, description, category, type, amount, memo, account, custom_label)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let imported = 0;
let skipped = 0;

const importAll = db.transaction(() => {
  for (const line of dataLines) {
    const cols = parseCsvLine(line);

    const [transDateStr, postDateStr, description, chaseCategory, type, amountStr, memo] = cols;

    if (!transDateStr || transDateStr === 'Transaction Date') { skipped++; continue; }
    if (!amountStr || amountStr.trim() === '') { skipped++; continue; }

    const amount = parseAmount(amountStr);
    if (amount === null) { skipped++; continue; }

    const transDate = parseDate(transDateStr);
    const postDate = parseDate(postDateStr);
    const category = mapCategory(chaseCategory);

    insert.run(
      transDate,
      postDate,
      description?.trim() ?? '',
      category,
      type?.trim() ?? null,
      amount,
      memo?.trim() || null,
      ACCOUNT_ID,
      category === null ? chaseCategory?.trim() : null
    );

    imported++;
  }
});

importAll();

console.log(`✅ Import complete — ${imported} imported, ${skipped} skipped`);

const uncategorised = db.prepare(`
  SELECT COUNT(*) as count FROM transactions 
  WHERE account = ? AND category IS NULL
`).get(ACCOUNT_ID);

console.log(`⚠ Uncategorised: ${uncategorised.count} transactions`);

db.close();