import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('accounts') === 'true') {
      const accounts = db.prepare(`
        SELECT DISTINCT account FROM transactions
        WHERE account IS NOT NULL
        ORDER BY account ASC
      `).all();
      return NextResponse.json(accounts.map(a => a.account));
    }

    if (searchParams.get('categories') === 'true') {
      const categories = db.prepare(`
        SELECT DISTINCT category FROM transactions
        WHERE category IS NOT NULL
        ORDER BY category ASC
      `).all();
      return NextResponse.json(categories.map(c => c.category));
    }

const transactions = db.prepare(`
      SELECT * FROM transactions
      ORDER BY transaction_date DESC, 
        COALESCE(split_group_id, CAST(id AS TEXT)) ASC,
        is_original_split DESC,
        id ASC
    `).all();

    return NextResponse.json(transactions);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, custom_description, custom_label, category, type, memo, action } = body;
    const clean = v => (v === '' || v === undefined) ? null : v;

    // --- Split a transaction ---
    if (action === 'split') {
      const { splits } = body; // [{ amount, category }, ...]

      // Validate splits sum to original amount
      const original = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
      if (!original) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

      const originalAmount = Math.abs(original.amount);
      const splitTotal = splits.reduce((sum, s) => sum + Math.abs(parseFloat(s.amount)), 0);

      if (Math.abs(splitTotal - originalAmount) > 0.01) {
        return NextResponse.json({ error: `Split amounts (${splitTotal.toFixed(2)}) must equal original amount (${originalAmount.toFixed(2)})` }, { status: 400 });
      }

      const splitGroupId = randomUUID();

      db.transaction(() => {
        // Mark original as split
        db.prepare(`
          UPDATE transactions 
          SET is_original_split = 1, split_group_id = ?
          WHERE id = ?
        `).run(splitGroupId, id);

        // Insert split rows
        for (const split of splits) {
          const splitAmount = original.amount < 0 ? -Math.abs(parseFloat(split.amount)) : Math.abs(parseFloat(split.amount));
          db.prepare(`
            INSERT INTO transactions (
              transaction_date, post_date, description, custom_description,
              category, type, amount, memo, account, split_group_id, is_original_split
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          `).run(
            original.transaction_date,
            original.post_date,
            original.description,
            split.custom_description ?? original.custom_description ?? null,
            split.category ?? null,
            original.type,
            splitAmount,
            split.memo ?? original.memo ?? null,
            original.account,
            splitGroupId
          );
        }
      })();

      return NextResponse.json({ success: true });
    }

    // --- Unsplit a transaction ---
    if (action === 'unsplit') {
      const original = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
      if (!original || !original.split_group_id) {
        return NextResponse.json({ error: 'Transaction is not split' }, { status: 400 });
      }

      db.transaction(() => {
        // Delete the split rows
        db.prepare(`
          DELETE FROM transactions 
          WHERE split_group_id = ? AND is_original_split = 0
        `).run(original.split_group_id);

        // Restore original
        db.prepare(`
          UPDATE transactions 
          SET is_original_split = 0, split_group_id = NULL
          WHERE id = ?
        `).run(id);
      })();

      return NextResponse.json({ success: true });
    }

    // --- Regular update ---
    db.prepare(`
      UPDATE transactions
      SET
        custom_description = ?,
        custom_label = ?,
        category = ?,
        type = ?,
        memo = ?
      WHERE id = ?
    `).run(clean(custom_description), clean(custom_label), clean(category), clean(type), clean(memo), id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      transaction_date,
      post_date,
      description,
      category,
      type,
      amount,
      memo,
      account,
    } = body;

    db.prepare(`
      INSERT INTO transactions (
        transaction_date,
        post_date,
        description,
        category,
        type,
        amount,
        memo,
        account
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transaction_date,
      post_date ?? null,
      description,
      category ?? null,
      type ?? null,
      amount,
      memo ?? null,
      account ?? 'manual'
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const tx = db.prepare(`SELECT split_group_id, is_original_split FROM transactions WHERE id = ?`).get(id);

    if (tx?.split_group_id && tx?.is_original_split) {
      // Deleting the original — delete all splits too
      db.prepare(`DELETE FROM transactions WHERE split_group_id = ?`).run(tx.split_group_id);
    } else if (tx?.split_group_id && tx?.is_original_split === 0) {
      // Deleting a split child
      db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);

      // Check if any children remain
      const remainingChildren = db.prepare(`
        SELECT COUNT(*) as count FROM transactions 
        WHERE split_group_id = ? AND is_original_split = 0
      `).get(tx.split_group_id);

if (parseInt(remainingChildren.count) === 0) {
        // No children left — restore the original
        const restoreResult = db.prepare(`
          UPDATE transactions 
          SET is_original_split = 0, split_group_id = NULL
          WHERE split_group_id = ?
        `).run(tx.split_group_id);
      }
    } else {
      // Regular delete
      db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}