import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

db.exec(`
  ALTER TABLE transactions ADD COLUMN plaid_transaction_id TEXT;
`);

console.log('plaid_transaction_id column added successfully!');
db.close();