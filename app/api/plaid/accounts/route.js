// app/api/plaid/accounts/route.js

import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

export async function GET() {
  try {
    const accounts = db.prepare(`
      SELECT
        id, institution_name, account_name, account_type,
        account_subtype, account_id, created_at
      FROM linked_accounts
      ORDER BY institution_name, account_name
    `).all();

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('GET /api/plaid/accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}