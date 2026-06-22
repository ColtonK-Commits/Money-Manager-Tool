import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite = new Database(path.join(__dirname, '..', 'money_manager.db'));
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Starting migration from SQLite to Postgres...\n');

  // 1. Users
  console.log('Migrating users...');
  const users = sqlite.prepare('SELECT * FROM users').all();
  for (const u of users) {
    await sql`
      INSERT INTO users (id, username, password, created_at)
      VALUES (${u.id}, ${u.username}, ${u.password}, ${u.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${users.length} users migrated`);

  // 2. Categories
  console.log('Migrating categories...');
  const categories = sqlite.prepare('SELECT * FROM categories').all();
  for (const c of categories) {
    await sql`
      INSERT INTO categories (id, name, colour, user_id)
      VALUES (${c.id}, ${c.name}, ${c.colour}, ${c.user_id})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${categories.length} categories migrated`);

  // 3. Transactions
  console.log('Migrating transactions... (this may take a minute)');
  const transactions = sqlite.prepare('SELECT * FROM transactions').all();
  for (const t of transactions) {
    await sql`
      INSERT INTO transactions (
        id, transaction_date, post_date, description, custom_description,
        custom_label, category, type, amount, memo, account,
        plaid_transaction_id, split_group_id, is_original_split, user_id
      )
      VALUES (
        ${t.id}, ${t.transaction_date}, ${t.post_date}, ${t.description},
        ${t.custom_description}, ${t.custom_label}, ${t.category}, ${t.type},
        ${t.amount}, ${t.memo}, ${t.account}, ${t.plaid_transaction_id},
        ${t.split_group_id}, ${t.is_original_split}, ${t.user_id}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${transactions.length} transactions migrated`);

  // 4. Monthly budgets
  console.log('Migrating monthly_budgets...');
  const budgets = sqlite.prepare('SELECT * FROM monthly_budgets').all();
  for (const b of budgets) {
    await sql`
      INSERT INTO monthly_budgets (id, category, month, monthly_target, user_id)
      VALUES (${b.id}, ${b.category}, ${b.month}, ${b.monthly_target}, ${b.user_id})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${budgets.length} monthly budgets migrated`);

  // 5. Merchants
  console.log('Migrating merchants...');
  const merchants = sqlite.prepare('SELECT * FROM merchants').all();
  for (const m of merchants) {
    await sql`
      INSERT INTO merchants (id, rule_name, pattern, created_at, user_id)
      VALUES (${m.id}, ${m.rule_name}, ${m.pattern}, ${m.created_at}, ${m.user_id})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${merchants.length} merchants migrated`);

  // 6. Merchant approvals
  console.log('Migrating merchant_approvals...');
  const approvals = sqlite.prepare('SELECT * FROM merchant_approvals').all();
  for (const a of approvals) {
    await sql`
      INSERT INTO merchant_approvals (id, merchant_id, original_description, approved)
      VALUES (${a.id}, ${a.merchant_id}, ${a.original_description}, ${a.approved})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${approvals.length} merchant approvals migrated`);

  // 7. Linked accounts
  console.log('Migrating linked_accounts...');
  const accounts = sqlite.prepare('SELECT * FROM linked_accounts').all();
  for (const a of accounts) {
    await sql`
      INSERT INTO linked_accounts (
        id, institution_name, account_name, account_type, account_subtype,
        account_id, access_token, cursor, last_synced, created_at, user_id
      )
      VALUES (
        ${a.id}, ${a.institution_name}, ${a.account_name}, ${a.account_type},
        ${a.account_subtype}, ${a.account_id}, ${a.access_token}, ${a.cursor},
        ${a.last_synced}, ${a.created_at}, ${a.user_id}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${accounts.length} linked accounts migrated`);

  // 8. Savings goals
  console.log('Migrating savings_goals...');
  const goals = sqlite.prepare('SELECT * FROM savings_goals').all();
  for (const g of goals) {
    await sql`
      INSERT INTO savings_goals (id, name, target_amount, target_date, archived, created_at, user_id)
      VALUES (${g.id}, ${g.name}, ${g.target_amount}, ${g.target_date}, ${g.archived}, ${g.created_at}, ${g.user_id})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${goals.length} savings goals migrated`);

  // 9. Goal contributions
  console.log('Migrating goal_contributions...');
  const contributions = sqlite.prepare('SELECT * FROM goal_contributions').all();
  for (const c of contributions) {
    await sql`
      INSERT INTO goal_contributions (id, goal_id, amount, note, contribution_date, created_at)
      VALUES (${c.id}, ${c.goal_id}, ${c.amount}, ${c.note}, ${c.contribution_date}, ${c.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`✅ ${contributions.length} goal contributions migrated`);

  // 10. Preferences
  console.log('Migrating preferences...');
  const prefs = sqlite.prepare('SELECT * FROM preferences').all();
  for (const p of prefs) {
    await sql`
      INSERT INTO preferences (key, value)
      VALUES (${p.key}, ${p.value})
      ON CONFLICT (key) DO NOTHING
    `;
  }
  console.log(`✅ ${prefs.length} preferences migrated`);

  // Reset all sequences so new inserts get correct IDs
  console.log('\nResetting Postgres sequences...');
  await sql`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`;
  await sql`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`;
  await sql`SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions))`;
  await sql`SELECT setval('monthly_budgets_id_seq', (SELECT MAX(id) FROM monthly_budgets))`;
  await sql`SELECT setval('merchants_id_seq', (SELECT MAX(id) FROM merchants))`;
  await sql`SELECT setval('linked_accounts_id_seq', (SELECT MAX(id) FROM linked_accounts))`;
  await sql`SELECT setval('savings_goals_id_seq', (SELECT MAX(id) FROM savings_goals))`;
  await sql`SELECT setval('goal_contributions_id_seq', (SELECT MAX(id) FROM goal_contributions))`;
  console.log('✅ Sequences reset');

  console.log('\n✅ Migration complete!');
  sqlite.close();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});