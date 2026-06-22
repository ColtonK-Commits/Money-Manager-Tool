// app/api/spending/route.js

import { NextResponse } from 'next/server';
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
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end query parameters are required' },
        { status: 400 }
      );
    }

    const rows = await sql`
      SELECT
        category,
        ROUND(-SUM(amount)::numeric, 2) AS total_spent
      FROM transactions
      WHERE
        transaction_date >= ${start}
        AND transaction_date <= ${end}
        AND user_id = ${userId}
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
      GROUP BY category
      ORDER BY total_spent DESC
    `;

    return NextResponse.json(rows.map(r => ({ ...r, total_spent: parseFloat(r.total_spent) })));
  } catch (error) {
    console.error('GET /api/spending error:', error);
    return NextResponse.json({ error: 'Failed to fetch spending data' }, { status: 500 });
  }
}