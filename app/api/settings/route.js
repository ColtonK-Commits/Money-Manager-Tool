// app/api/settings/route.js

import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Get all categories
    if (type === 'categories') {
      const categories = db.prepare(`
        SELECT c.id, c.name, c.colour,
          COUNT(t.id) AS transaction_count
        FROM categories c
        LEFT JOIN transactions t ON t.category = c.name AND t.user_id = ?
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.name ASC
      `).all(userId, userId);
      return NextResponse.json(categories);
    }

    // Get all linked accounts
    if (type === 'accounts') {
      const accounts = db.prepare(`
        SELECT id, institution_name, account_name, account_type, account_subtype, account_id, created_at
        FROM linked_accounts
        WHERE user_id = ?
        ORDER BY institution_name, account_name
      `).all(userId);
      return NextResponse.json(accounts);
    }

    // Get preferences — keyed per user using prefix
    if (type === 'preferences') {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `).run();

      const prefs = db.prepare(`
        SELECT key, value FROM preferences
        WHERE key LIKE ?
      `).all(`${userId}_%`);

      const prefMap = { currency_symbol: '$', default_date_range: 'current_month' };
      for (const p of prefs) {
        const bareKey = p.key.replace(`${userId}_`, '');
        prefMap[bareKey] = p.value;
      }
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
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    // Rename a category
    if (action === 'rename_category') {
      const { old_name, new_name } = body;
      if (!old_name || !new_name) return NextResponse.json({ error: 'old_name and new_name required' }, { status: 400 });

      db.transaction(() => {
        db.prepare(`UPDATE transactions SET category = ? WHERE category = ? AND user_id = ?`).run(new_name, old_name, userId);
        db.prepare(`UPDATE monthly_budgets SET category = ? WHERE category = ? AND user_id = ?`).run(new_name, old_name, userId);
        db.prepare(`UPDATE categories SET name = ? WHERE name = ? AND user_id = ?`).run(new_name, old_name, userId);
      })();

      return NextResponse.json({ success: true });
    }

    // Update category colour
    if (action === 'update_colour') {
      const { name, colour } = body;
      db.prepare(`UPDATE categories SET colour = ? WHERE name = ? AND user_id = ?`).run(colour, name, userId);
      return NextResponse.json({ success: true });
    }

    // Merge two categories
    if (action === 'merge_categories') {
      const { source, target } = body;
      if (!source || !target) return NextResponse.json({ error: 'source and target required' }, { status: 400 });

      db.transaction(() => {
        db.prepare(`UPDATE transactions SET category = ? WHERE category = ? AND user_id = ?`).run(target, source, userId);
        db.prepare(`
          UPDATE monthly_budgets SET category = ?
          WHERE category = ? AND user_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM monthly_budgets
            WHERE category = ? AND month = monthly_budgets.month AND user_id = ?
          )
        `).run(target, source, userId, target, userId);
        db.prepare(`DELETE FROM monthly_budgets WHERE category = ? AND user_id = ?`).run(source, userId);
        db.prepare(`DELETE FROM categories WHERE name = ? AND user_id = ?`).run(source, userId);
      })();

      return NextResponse.json({ success: true });
    }

    // Delete a category
    if (action === 'delete_category') {
      const { name } = body;
      db.transaction(() => {
        db.prepare(`UPDATE transactions SET category = NULL WHERE category = ? AND user_id = ?`).run(name, userId);
        db.prepare(`DELETE FROM monthly_budgets WHERE category = ? AND user_id = ?`).run(name, userId);
        db.prepare(`DELETE FROM categories WHERE name = ? AND user_id = ?`).run(name, userId);
      })();
      return NextResponse.json({ success: true });
    }

    // Delete a linked account
    if (action === 'delete_account') {
      const { account_id } = body;
      db.transaction(() => {
        db.prepare(`DELETE FROM transactions WHERE account = ? AND user_id = ?`).run(account_id, userId);
        db.prepare(`DELETE FROM linked_accounts WHERE account_id = ? AND user_id = ?`).run(account_id, userId);
      })();
      return NextResponse.json({ success: true });
    }

    // Clear all sandbox/test data (Plaid transactions only)
    if (action === 'clear_sandbox_data') {
      db.transaction(() => {
        db.prepare(`
          DELETE FROM transactions
          WHERE user_id = ?
          AND account IN (SELECT account_id FROM linked_accounts WHERE user_id = ?)
        `).run(userId, userId);
        db.prepare(`UPDATE linked_accounts SET cursor = NULL WHERE user_id = ?`).run(userId);
      })();
      return NextResponse.json({ success: true });
    }

    // Reset Plaid cursors only (keeps transactions)
    if (action === 'reset_cursors') {
      db.prepare(`UPDATE linked_accounts SET cursor = NULL WHERE user_id = ?`).run(userId);
      return NextResponse.json({ success: true });
    }

    // Save a preference — keyed per user using prefix
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
      `).run(`${userId}_${key}`, value);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}