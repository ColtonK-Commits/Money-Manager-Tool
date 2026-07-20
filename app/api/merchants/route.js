import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import sql from '../../../lib/db';

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const merchants = await sql`
      SELECT * FROM merchants
      WHERE user_id = ${userId}
      ORDER BY rule_name ASC
    `;
    return NextResponse.json(merchants);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await request.json();
    const { rule_name, pattern, reapply } = body;

    const transactions = reapply
      ? await sql`
          SELECT id, description FROM transactions
          WHERE LOWER(description) LIKE LOWER(${`%${pattern}%`})
          AND user_id = ${userId}
          AND (custom_description IS NULL OR custom_description != ${rule_name})
        `
      : await sql`
          SELECT id, description FROM transactions
          WHERE LOWER(description) LIKE LOWER(${`%${pattern}%`})
          AND user_id = ${userId}
        `;

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

    // Update existing merchant rule name/pattern only
    if (body.id && !body.approvedIds) {
      await sql`
        UPDATE merchants SET rule_name = ${body.rule_name}, pattern = ${body.pattern}
        WHERE id = ${body.id} AND user_id = ${userId}
      `;
      return NextResponse.json({ success: true });
    }

    const { rule_name, pattern, approvedIds, existingMerchantId } = body;

    if (!Array.isArray(approvedIds)) {
      return NextResponse.json({ error: 'approvedIds must be an array' }, { status: 400 });
    }

    let merchantId;

    if (existingMerchantId) {
      merchantId = Number(existingMerchantId);
    } else {
      const result = await sql`
        INSERT INTO merchants (rule_name, pattern, user_id)
        VALUES (${rule_name}, ${pattern}, ${userId})
        RETURNING id
      `;
      merchantId = Number(result[0].id);
    }

    for (const id of approvedIds) {
      const numericId = Number(id);

      const txRows = await sql`
        SELECT description FROM transactions
        WHERE id = ${numericId} AND user_id = ${userId}
      `;
      const description = txRows[0]?.description ?? null;

      await sql`
        INSERT INTO merchant_approvals (merchant_id, original_description, approved)
        VALUES (${merchantId}, ${description}, ${1})
      `;

      await sql`
        UPDATE transactions
        SET custom_description = ${rule_name}
        WHERE id = ${numericId} AND user_id = ${userId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/merchants error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const merchant = await sql`SELECT id FROM merchants WHERE id = ${id} AND user_id = ${userId}`;
    if (merchant.length === 0) return NextResponse.json({ error: 'Merchant rule not found' }, { status: 404 });

    const approvals = await sql`
      SELECT original_description FROM merchant_approvals
      WHERE merchant_id = ${id} AND approved = 1
    `;

    for (const approval of approvals) {
      const ruleName = await sql`SELECT rule_name FROM merchants WHERE id = ${id}`;
      await sql`
        UPDATE transactions
        SET custom_description = NULL
        WHERE custom_description = ${ruleName[0].rule_name}
        AND description = ${approval.original_description}
        AND user_id = ${userId}
      `;
    }

    await sql`DELETE FROM merchant_approvals WHERE merchant_id = ${id}`;
    await sql`DELETE FROM merchants WHERE id = ${id} AND user_id = ${userId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}