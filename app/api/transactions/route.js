import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import sql from '../../../lib/db';

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

    if (searchParams.get('accounts') === 'true') {
      const accounts = await sql`
        SELECT DISTINCT account FROM transactions
        WHERE account IS NOT NULL
        AND user_id = ${userId}
        ORDER BY account ASC
      `;
      return NextResponse.json(accounts.map(a => a.account));
    }

    if (searchParams.get('categories') === 'true') {
      const categories = await sql`
        SELECT DISTINCT category FROM transactions
        WHERE category IS NOT NULL
        AND user_id = ${userId}
        ORDER BY category ASC
      `;
      return NextResponse.json(categories.map(c => c.category));
    }

    const transactions = await sql`
      SELECT * FROM transactions
      WHERE user_id = ${userId}
      ORDER BY transaction_date DESC,
        COALESCE(split_group_id, CAST(id AS TEXT)) ASC,
        is_original_split DESC,
        id ASC
    `;

    return NextResponse.json(transactions);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await request.json();
    const { id, custom_description, custom_label, category, type, memo, action } = body;
    const clean = v => (v === '' || v === undefined) ? null : v;

    // --- Split a transaction ---
    if (action === 'split') {
      const { splits } = body;

      const rows = await sql`
        SELECT * FROM transactions WHERE id = ${id} AND user_id = ${userId}
      `;
      const original = rows[0];
      if (!original) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

      const originalAmount = Math.abs(original.amount);
      const splitTotal = splits.reduce((sum, s) => sum + Math.abs(parseFloat(s.amount)), 0);

      if (Math.abs(splitTotal - originalAmount) > 0.01) {
        return NextResponse.json({
          error: `Split amounts (${splitTotal.toFixed(2)}) must equal original amount (${originalAmount.toFixed(2)})`
        }, { status: 400 });
      }

      const splitGroupId = randomUUID();

      await sql`
        UPDATE transactions
        SET is_original_split = 1, split_group_id = ${splitGroupId}
        WHERE id = ${id} AND user_id = ${userId}
      `;

      for (const split of splits) {
        const splitAmount = original.amount < 0
          ? -Math.abs(parseFloat(split.amount))
          : Math.abs(parseFloat(split.amount));
        await sql`
          INSERT INTO transactions (
            transaction_date, post_date, description, custom_description,
            category, type, amount, memo, account, split_group_id, is_original_split, user_id
          ) VALUES (
            ${original.transaction_date}, ${original.post_date}, ${original.description},
            ${split.custom_description ?? original.custom_description ?? null},
            ${split.category ?? null}, ${original.type}, ${splitAmount},
            ${split.memo ?? original.memo ?? null}, ${original.account},
            ${splitGroupId}, ${0}, ${userId}
          )
        `;
      }

      return NextResponse.json({ success: true });
    }

    // --- Unsplit a transaction ---
    if (action === 'unsplit') {
      const rows = await sql`
        SELECT * FROM transactions WHERE id = ${id} AND user_id = ${userId}
      `;
      const original = rows[0];
      if (!original || !original.split_group_id) {
        return NextResponse.json({ error: 'Transaction is not split' }, { status: 400 });
      }

      await sql`
        DELETE FROM transactions
        WHERE split_group_id = ${original.split_group_id}
        AND is_original_split = 0 AND user_id = ${userId}
      `;

      await sql`
        UPDATE transactions
        SET is_original_split = 0, split_group_id = NULL
        WHERE id = ${id} AND user_id = ${userId}
      `;

      return NextResponse.json({ success: true });
    }

    // --- Regular update ---
    await sql`
      UPDATE transactions
      SET
        custom_description = ${clean(custom_description)},
        custom_label = ${clean(custom_label)},
        category = ${clean(category)},
        type = ${clean(type)},
        memo = ${clean(memo)}
      WHERE id = ${id} AND user_id = ${userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

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

    await sql`
      INSERT INTO transactions (
        transaction_date, post_date, description, category,
        type, amount, memo, account, user_id
      ) VALUES (
        ${transaction_date}, ${post_date ?? null}, ${description},
        ${category ?? null}, ${type ?? null}, ${amount},
        ${memo ?? null}, ${account ?? 'manual'}, ${userId}
      )
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const rows = await sql`
      SELECT split_group_id, is_original_split FROM transactions
      WHERE id = ${id} AND user_id = ${userId}
    `;
    const tx = rows[0];

    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    if (tx.split_group_id && tx.is_original_split) {
      await sql`
        DELETE FROM transactions WHERE split_group_id = ${tx.split_group_id} AND user_id = ${userId}
      `;
    } else if (tx.split_group_id && tx.is_original_split === 0) {
      await sql`DELETE FROM transactions WHERE id = ${id} AND user_id = ${userId}`;

      const remaining = await sql`
        SELECT COUNT(*) AS count FROM transactions
        WHERE split_group_id = ${tx.split_group_id} AND is_original_split = 0 AND user_id = ${userId}
      `;

      if (parseInt(remaining[0].count) === 0) {
        await sql`
          UPDATE transactions
          SET is_original_split = 0, split_group_id = NULL
          WHERE split_group_id = ${tx.split_group_id} AND user_id = ${userId}
        `;
      }
    } else {
      await sql`DELETE FROM transactions WHERE id = ${id} AND user_id = ${userId}`;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}