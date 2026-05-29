// app/api/settings/route.js

import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Get all categories
    if (type === 'categories') {
      const categories = db.prepare(`
        SELECT c.id, c.name, c.colour,
          COUNT(t.id) AS transaction_count
        FROM categories c
        LEFT JOIN transactions t ON t.category = c.name
        GROUP BY c.id
        ORDER BY c.name ASC
      `).all();
      return NextResponse.json(categories);
    }

    // Get all linked accounts
    if (type === 'accounts') {
      const accounts = db.prepare(`
        SELECT id, institution_name, account_name, account_type, account_subtype, account_id, created_at
        FROM linked_accounts
        ORDER BY institution_name, account_name
      `).all();
      return NextResponse.json(accounts);
    }

    // Get preferences
    if (type === 'preferences') {
      // Check if preferences table exists, create if not
      db.prepare(`
        CREATE TABLE IF NOT EXISTS preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `).run();

      const prefs = db.prepare(`SELECT key, value FROM preferences`).all();
      const prefMap = { currency_symbol: '$', default_date_range: 'current_month' };
      for (const p of prefs) prefMap[p.key] = p.value;
      return NextResponse.json(prefMap);
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Rename a category
    if (action === 'rename_category') {
      const { old_name, new_name } = body;
      if (!old_name || !new_name) return NextResponse.json({ error: 'old_name and new_name required' }, { status: 400 });

      db.transaction(() => {
        db.prepare(`UPDATE transactions SET category = ? WHERE category = ?`).run(new_name, old_name);
        db.prepare(`UPDATE monthly_budgets SET category = ? WHERE category = ?`).run(new_name, old_name);
        db.prepare(`UPDATE categories SET name = ? WHERE name = ?`).run(new_name, old_name);
      })();

      return NextResponse.json({ success: true });
    }

    // Update category colour
    if (action === 'update_colour') {
      const { name, colour } = body;
      db.prepare(`UPDATE categories SET colour = ? WHERE name = ?`).run(colour, name);
      return NextResponse.json({ success: true });
    }

    // Merge two categories
    if (action === 'merge_categories') {
      const { source, target } = body;
      if (!source || !target) return NextResponse.json({ error: 'source and target required' }, { status: 400 });

      db.transaction(() => {
        db.prepare(`UPDATE transactions SET category = ? WHERE category = ?`).run(target, source);
        db.prepare(`UPDATE monthly_budgets SET category = ? WHERE category = ? AND NOT EXISTS (SELECT 1 FROM monthly_budgets WHERE category = ? AND month = monthly_budgets.month)`).run(target, source, target);
        db.prepare(`DELETE FROM monthly_budgets WHERE category = ?`).run(source);
        db.prepare(`DELETE FROM categories WHERE name = ?`).run(source);
      })();

      return NextResponse.json({ success: true });
    }

    // Delete a category
    if (action === 'delete_category') {
      const { name } = body;
      db.transaction(() => {
        db.prepare(`UPDATE transactions SET category = NULL WHERE category = ?`).run(name);
        db.prepare(`DELETE FROM monthly_budgets WHERE category = ?`).run(name);
        db.prepare(`DELETE FROM categories WHERE name = ?`).run(name);
      })();
      return NextResponse.json({ success: true });
    }

    // Delete a linked account
    if (action === 'delete_account') {
      const { account_id } = body;
      db.transaction(() => {
        db.prepare(`DELETE FROM transactions WHERE account = ?`).run(account_id);
        db.prepare(`DELETE FROM linked_accounts WHERE account_id = ?`).run(account_id);
      })();
      return NextResponse.json({ success: true });
    }

    // Clear all sandbox/test data (Plaid transactions only)
    if (action === 'clear_sandbox_data') {
      db.transaction(() => {
        db.prepare(`
          DELETE FROM transactions
          WHERE account IN (SELECT account_id FROM linked_accounts)
        `).run();
        db.prepare(`UPDATE linked_accounts SET cursor = NULL`).run();
      })();
      return NextResponse.json({ success: true });
    }

    // Reset Plaid cursors only (keeps transactions)
    if (action === 'reset_cursors') {
      db.prepare(`UPDATE linked_accounts SET cursor = NULL`).run();
      return NextResponse.json({ success: true });
    }

    // Save a preference
    if (action === 'save_preference') {
      const { key, value } = body;
      db.prepare(`
        CREATE TABLE IF NOT EXISTS preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `).run();
      db.prepare(`
        INSERT INTO preferences (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, value);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}