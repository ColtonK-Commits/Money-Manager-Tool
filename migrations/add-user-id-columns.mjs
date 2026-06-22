import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

console.log('Adding user_id columns...');

const tables = ['transactions', 'categories', 'monthly_budgets', 'merchants', 'merchant_approvals', 'linked_accounts', 'savings_goals'];

for (const table of tables) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id)`);
    console.log(`✅ Added user_id to ${table}`);
  } catch (err) {
    if (err.message.includes('duplicate column')) {
      console.log(`⚠️  user_id already exists on ${table}, skipping`);
    } else {
      throw err;
    }
  }
}

console.log('Assigning existing data to user_id = 1...');

for (const table of tables) {
  db.prepare(`UPDATE ${table} SET user_id = 1 WHERE user_id IS NULL`).run();
}

console.log('✅ All existing data assigned to user 1');
db.close();