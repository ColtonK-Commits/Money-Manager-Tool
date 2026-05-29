import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

export async function GET() {
  try {
    const merchants = db.prepare(`
      SELECT * FROM merchants
      ORDER BY rule_name ASC
    `).all();

    return NextResponse.json(merchants);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { rule_name, pattern } = await request.json();

    const transactions = db.prepare(`
      SELECT id, description FROM transactions
      WHERE LOWER(description) LIKE LOWER(?)
    `).all(`%${pattern}%`);

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
    const body = await request.json();

    if (body.id && !body.approvedIds) {
      db.prepare(`
        UPDATE merchants SET rule_name = ?, pattern = ? WHERE id = ?
      `).run(body.rule_name, body.pattern, body.id);
      return NextResponse.json({ success: true });
    }

    const { rule_name, pattern, approvedIds } = body;

    const result = db.prepare(`
      INSERT INTO merchants (rule_name, pattern)
      VALUES (?, ?)
    `).run(rule_name, pattern);

    const merchantId = result.lastInsertRowid;

    for (const id of approvedIds) {
      db.prepare(`
        INSERT INTO merchant_approvals (merchant_id, original_description, approved)
        VALUES (?, (SELECT description FROM transactions WHERE id = ?), 1)
      `).run(merchantId, id);

      db.prepare(`
        UPDATE transactions SET custom_description = ? WHERE id = ?
      `).run(rule_name, id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

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
      `).run(id, approval.original_description);
    }

    db.prepare(`DELETE FROM merchant_approvals WHERE merchant_id = ?`).run(id);
    db.prepare(`DELETE FROM merchants WHERE id = ?`).run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}