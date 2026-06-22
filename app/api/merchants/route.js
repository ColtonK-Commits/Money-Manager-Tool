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

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const merchants = db.prepare(`
      SELECT * FROM merchants
      WHERE user_id = ?
      ORDER BY rule_name ASC
    `).all(userId);
    return NextResponse.json(merchants);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { rule_name, pattern } = await request.json();

    const transactions = db.prepare(`
      SELECT id, description FROM transactions
      WHERE LOWER(description) LIKE LOWER(?)
      AND user_id = ?
    `).all(`%${pattern}%`, userId);

    const autoApproved = [];
    const needsReview = [];
    const strictRegex = new RegExp(`^${pattern}(\\s+[\\w\\s,.-]*)?$`, 'i');
    const containsRegex = new RegExp(pattern, 'i');

    for (const t of transactions) {
      if (strictRegex.test(t.description.trim())) {
        autoApproved.push(t);
      } else if (containsRegex.test(t.description)) {
        needsReview.push(t);
      }
    }

    return NextResponse.json({ autoApproved, needsReview });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await request.json();

    // Update existing merchant rule
    if (body.id && !body.approvedIds) {
      db.prepare(`
        UPDATE merchants SET rule_name = ?, pattern = ?
        WHERE id = ? AND user_id = ?
      `).run(body.rule_name, body.pattern, body.id, userId);
      return NextResponse.json({ success: true });
    }

    const { rule_name, pattern, approvedIds } = body;

    const result = db.prepare(`
      INSERT INTO merchants (rule_name, pattern, user_id)
      VALUES (?, ?, ?)
    `).run(rule_name, pattern, userId);

    const merchantId = result.lastInsertRowid;

    for (const id of approvedIds) {
      db.prepare(`
        INSERT INTO merchant_approvals (merchant_id, original_description, approved)
        VALUES (?, (SELECT description FROM transactions WHERE id = ? AND user_id = ?), 1)
      `).run(merchantId, id, userId);

      db.prepare(`
        UPDATE transactions SET custom_description = ?
        WHERE id = ? AND user_id = ?
      `).run(rule_name, id, userId);
    }

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

    // Verify the merchant rule belongs to this user
    const merchant = db.prepare(`SELECT id FROM merchants WHERE id = ? AND user_id = ?`).get(id, userId);
    if (!merchant) return NextResponse.json({ error: 'Merchant rule not found' }, { status: 404 });

    const approvals = db.prepare(`
      SELECT original_description FROM merchant_approvals
      WHERE merchant_id = ? AND approved = 1
    `).all(id);

    for (const approval of approvals) {
      db.prepare(`
        UPDATE transactions
        SET custom_description = NULL
        WHERE custom_description = (
          SELECT rule_name FROM merchants WHERE id = ?
        )
        AND description = ?
        AND user_id = ?
      `).run(id, approval.original_description, userId);
    }

    db.prepare(`DELETE FROM merchant_approvals WHERE merchant_id = ?`).run(id);
    db.prepare(`DELETE FROM merchants WHERE id = ? AND user_id = ?`).run(id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}