import Database from 'better-sqlite3';
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the database
const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

// Load the Excel file
const workbook = readFile('C:\\Users\\LenovoT420s\\Documents\\2024\\MMT Data\\AprilCCData.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = utils.sheet_to_json(sheet);

console.log(`Found ${rows.length} transactions to import...`);

// Prepare the insert statement
const insert = db.prepare(`
  INSERT INTO transactions (
    transaction_date,
    post_date,
    description,
    category,
    type,
    amount,
    memo,
    account
  ) VALUES (
    @transaction_date,
    @post_date,
    @description,
    @category,
    @type,
    @amount,
    @memo,
    @account
  )
`);

// Loop through each row and insert it
let count = 0;
for (const row of rows) {
  insert.run({
    transaction_date: row['Transaction Date'] ? new Date(Math.round((row['Transaction Date'] - 25569) * 86400 * 1000)).toISOString().split('T')[0] : null,
    post_date: row['Post Date'] ? new Date(Math.round((row['Post Date'] - 25569) * 86400 * 1000)).toISOString().split('T')[0] : null,
    description: row['Description'] ?? null,
    category: row['Category'] ?? null,
    type: row['Type'] ?? null,
    amount: row['Amount'] ?? null,
    memo: row['Memo'] ?? null,
    account: 'AprilCCData'
  });
  count++;
}

console.log(`Successfully imported ${count} transactions!`);
db.close();