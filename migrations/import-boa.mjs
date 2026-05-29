// migrations/import-boa.mjs

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

const ACCOUNT_ID = 'BOA-CHECKING-MANUAL';

// Auto-categorisation rules based on description patterns
function categorise(description) {
  const d = description.toUpperCase();

  // Transfers — internal bank movements
  if (d.includes('ONLINE BANKING TRANSFER') ||
      d.includes('ONLINE SCHEDULED TRANSFER') ||
      d.includes('ZELLE') ||
      d.includes('CHASE CREDIT CRD') ||
      d.includes('SCHWAB BROKERAGE') ||
      d.includes('REVOLUT') ||
      d.includes('VENMO') ||
      d.includes('PAYPAL') ||
      d.includes('AMERICAN EXPRESS') ||
      d.includes('ONLINE BANKING PAYMENT') ||
      d.includes('ONLINE SCHEDULED PAYMENT') ||
      d.includes('CARDCASH')) return 'Transfer';

  // Income
  if (d.includes('IRS TREAS') ||
      d.includes('TAX REF') ||
      d.includes('GEORGIA') ||
      d.includes('ROBINHOOD') ||
      d.includes('WISE') ||
      d.includes('BEGINNING BALANCE')) return 'Income';

  // ATM/Cash withdrawals — travel since mostly international
  if (d.includes('WITHDRWL') ||
      d.includes('IC CASH') ||
      d.includes('ATM')) return 'Withdrawal';

  // Fees
  if (d.includes('FEE') ||
      d.includes('INTERNATIONAL TRANSACTION')) return 'Fees & Adjustments';

  return null; // Uncategorised
}

function parseAmount(str) {
  if (!str || str.trim() === '') return null;
  // Remove commas and parse
  return parseFloat(str.replace(/,/g, ''));
}

function parseDate(str) {
  // BOA format: M/D/YYYY → YYYY-MM-DD
  const [month, day, year] = str.trim().split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Read the CSV
const csvPath = path.join(__dirname, '..', 'boa-checking.csv');
if (!fs.existsSync(csvPath)) {
  console.error('❌ boa-checking.csv not found in project root');
  process.exit(1);
}

const lines = fs.readFileSync(csvPath, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0);

// Skip header row
const dataLines = lines.slice(1);

const insert = db.prepare(`
  INSERT INTO transactions
    (transaction_date, post_date, description, category, amount, account, type)
  SELECT ?, ?, ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1 FROM transactions
    WHERE transaction_date = ?
      AND description = ?
      AND amount = ?
      AND account = ?
  )
`);

let imported = 0;
let skipped = 0;

const importAll = db.transaction(() => {
  for (const line of dataLines) {
    // Parse CSV — handle commas inside quoted fields
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { cols.push(current); current = ''; continue; }
      current += char;
    }
    cols.push(current);

    const [dateStr, description, amountStr] = cols;

    // Skip header and balance rows
    if (!dateStr || dateStr === 'Date') continue;
    if (description.includes('Beginning balance')) continue;

    const amount = parseAmount(amountStr);
    if (amount === null) continue;

    const date = parseDate(dateStr);
    const category = categorise(description);
    // Positive = money in (store as positive), Negative = money out (store as negative)
    const storedAmount = amount;
    const type = amount > 0 ? 'credit' : 'expense';

    const result = insert.run(
      date, date, description.trim(), category,
      storedAmount, ACCOUNT_ID, type,
      date, description.trim(), storedAmount, ACCOUNT_ID
    );

    if (result.changes > 0) imported++;
    else skipped++;
  }
});

importAll();

console.log(`✅ Import complete — ${imported} imported, ${skipped} skipped (duplicates)`);
db.close();