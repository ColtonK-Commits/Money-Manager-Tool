import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function setup() {
  console.log('Creating tables in Neon...');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ users');

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      colour TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      UNIQUE(name, user_id)
    )
  `;
  console.log('✅ categories');

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      transaction_date TEXT NOT NULL,
      post_date TEXT,
      description TEXT NOT NULL,
      custom_description TEXT,
      custom_label TEXT,
      category TEXT,
      type TEXT,
      amount REAL NOT NULL,
      memo TEXT,
      account TEXT DEFAULT 'manual',
      plaid_transaction_id TEXT,
      split_group_id TEXT,
      is_original_split INTEGER DEFAULT 0,
      user_id INTEGER REFERENCES users(id)
    )
  `;
  console.log('✅ transactions');

  await sql`
    CREATE TABLE IF NOT EXISTS monthly_budgets (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      month TEXT NOT NULL,
      monthly_target REAL NOT NULL,
      user_id INTEGER REFERENCES users(id),
      UNIQUE(category, month, user_id)
    )
  `;
  console.log('✅ monthly_budgets');

  await sql`
    CREATE TABLE IF NOT EXISTS merchants (
      id SERIAL PRIMARY KEY,
      rule_name TEXT NOT NULL,
      pattern TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id)
    )
  `;
  console.log('✅ merchants');

  await sql`
    CREATE TABLE IF NOT EXISTS merchant_approvals (
      id SERIAL PRIMARY KEY,
      merchant_id INTEGER NOT NULL REFERENCES merchants(id),
      original_description TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0
    )
  `;
  console.log('✅ merchant_approvals');

  await sql`
    CREATE TABLE IF NOT EXISTS linked_accounts (
      id SERIAL PRIMARY KEY,
      institution_name TEXT,
      account_name TEXT,
      account_type TEXT,
      account_subtype TEXT,
      account_id TEXT,
      access_token TEXT,
      cursor TEXT,
      last_synced TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id)
    )
  `;
  console.log('✅ linked_accounts');

  await sql`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      target_date TEXT,
      archived INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id)
    )
  `;
  console.log('✅ savings_goals');

  await sql`
    CREATE TABLE IF NOT EXISTS goal_contributions (
      id SERIAL PRIMARY KEY,
      goal_id INTEGER NOT NULL REFERENCES savings_goals(id),
      amount REAL NOT NULL,
      note TEXT,
      contribution_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ goal_contributions');

  await sql`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
  console.log('✅ preferences');

  await sql`
    CREATE TABLE IF NOT EXISTS budgets (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL UNIQUE,
      monthly_target REAL NOT NULL
    )
  `;
  console.log('✅ budgets (legacy, unused)');

  console.log('✅ All tables created successfully');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});