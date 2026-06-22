import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

console.log('Rebuilding monthly_budgets table with per-user unique constraint...');

db.exec(`
  CREATE TABLE monthly_budgets_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    month TEXT NOT NULL,
    monthly_target REAL NOT NULL,
    user_id INTEGER REFERENCES users(id),
    UNIQUE(category, month, user_id)
  );

  INSERT INTO monthly_budgets_new (id, category, month, monthly_target, user_id)
  SELECT id, category, month, monthly_target, user_id FROM monthly_budgets;

  DROP TABLE monthly_budgets;

  ALTER TABLE monthly_budgets_new RENAME TO monthly_budgets;
`);

console.log('✅ monthly_budgets table rebuilt with per-user unique constraint');
db.close();