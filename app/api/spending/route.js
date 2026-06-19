// app/api/spending/route.js

import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

// Opens a connection to your SQLite database file
const db = new Database(path.join(process.cwd(), 'money_manager.db'));

// GET — accepts a start and end date, returns total spending per category in that range
export async function GET(request) {
  try {
    // Read the date range from the URL, e.g. /api/spending?start=2024-01-01&end=2024-01-31
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // Both dates are required
    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end query parameters are required' },
        { status: 400 }
      );
    }

    // Query transactions in the date range, group by category, sum the amounts
    // ABS() flips negative amounts to positive for display purposes
const rows = db.prepare(`
      SELECT
        category,
        ROUND(-SUM(amount), 2) AS total_spent
      FROM transactions
      WHERE
        transaction_date >= ?
        AND transaction_date <= ?
        AND category IS NOT NULL
        AND category != ''
        AND category != 'Transfer'
        AND category != 'Withdrawal'
        AND category != 'Income'
        AND is_original_split != 1
      GROUP BY category
      ORDER BY total_spent DESC
    `).all(start, end);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/spending error:', error);
    return NextResponse.json({ error: 'Failed to fetch spending data' }, { status: 500 });
  }
}