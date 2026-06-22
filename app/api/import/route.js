// app/api/import/route.js

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import sql from '../../../lib/db';
import Papa from 'papaparse';

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();

    const { data, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: 'CSV parsing failed', details: errors }, { status: 400 });
    }

    if (data.length === 0) {
      return NextResponse.json({ error: 'No rows found in CSV' }, { status: 400 });
    }

    // Validate required columns
    const required = ['transaction_date', 'description', 'amount'];
    const headers = Object.keys(data[0]);
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Missing required columns: ${missing.join(', ')}`,
      }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    const rowErrors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 because row 1 is headers

      // Validate date
      const date = row.transaction_date?.trim();
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        rowErrors.push(`Row ${rowNum}: invalid date "${date}" — must be YYYY-MM-DD`);
        skipped++;
        continue;
      }

      // Validate amount
      const amount = parseFloat(row.amount);
      if (isNaN(amount)) {
        rowErrors.push(`Row ${rowNum}: invalid amount "${row.amount}"`);
        skipped++;
        continue;
      }

      // Validate description
      const description = row.description?.trim();
      if (!description) {
        rowErrors.push(`Row ${rowNum}: missing description`);
        skipped++;
        continue;
      }

      const category = row.category?.trim() || null;
      const type = row.type?.trim() || null;
      const memo = row.memo?.trim() || null;
      const account = row.account?.trim() || 'manual import';

      await sql`
        INSERT INTO transactions (
          transaction_date, description, category, type, amount, memo, account, user_id
        ) VALUES (
          ${date}, ${description}, ${category}, ${type}, ${amount}, ${memo}, ${account}, ${userId}
        )
      `;

      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: rowErrors,
    });

  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}