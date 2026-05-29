import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    colour TEXT NOT NULL
  );
`);

const categories = [
  { name: 'Bills & Utilities', colour: '#ef4444' },
  { name: 'Shopping', colour: '#f97316' },
  { name: 'Groceries', colour: '#22c55e' },
  { name: 'Travel', colour: '#3b82f6' },
  { name: 'Food & Drink', colour: '#eab308' },
  { name: 'Fees & Adjustments', colour: '#6b7280' },
  { name: 'Gas', colour: '#92400e' },
  { name: 'Entertainment', colour: '#a855f7' },
  { name: 'Personal', colour: '#ec4899' },
  { name: 'Home', colour: '#14b8a6' },
  { name: 'Professional Services', colour: '#6366f1' },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO categories (name, colour)
  VALUES (@name, @colour)
`);

for (const category of categories) {
  insert.run(category);
}

console.log('Categories table created and seeded successfully!');
db.close();