// app/api/plaid/accounts/route.js

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import sql from '../../../../lib/db';

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const accounts = await sql`
      SELECT
        id, institution_name, account_name, account_type,
        account_subtype, account_id, created_at
      FROM linked_accounts
      WHERE user_id = ${userId}
      ORDER BY institution_name, account_name
    `;

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('GET /api/plaid/accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}