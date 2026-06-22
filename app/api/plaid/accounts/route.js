// app/api/plaid/accounts/route.js

import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

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

    const accounts = db.prepare(`
      SELECT
        id, institution_name, account_name, account_type,
        account_subtype, account_id, created_at
      FROM linked_accounts
      WHERE user_id = ?
      ORDER BY institution_name, account_name
    `).all(userId);

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('GET /api/plaid/accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}