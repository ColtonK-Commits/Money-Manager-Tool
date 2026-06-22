import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'money_manager.db'));

console.log('Rebuilding categories table with per-user unique constraint...');

db.exec(`
  CREATE TABLE categories_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    colour TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    UNIQUE(name, user_id)
  );

  INSERT INTO categories_new (id, name, colour, user_id)
  SELECT id, name, colour, user_id FROM categories;

  DROP TABLE categories;

  ALTER TABLE categories_new RENAME TO categories;
`);

console.log('✅ categories table rebuilt successfully with per-user unique names');
db.close();