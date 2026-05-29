// app/api/plaid/update-ids/route.js

import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid';
import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);
const db = new Database(path.join(process.cwd(), 'money_manager.db'));

export async function POST(request) {
  try {
    const { account_id } = await request.json();

    const linkedAccount = db.prepare(`
      SELECT access_token FROM linked_accounts WHERE account_id = ?
    `).get(account_id);

    if (!linkedAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Pull last 90 days to match existing transactions
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(new Date().setDate(new Date().getDate() - 90))
      .toISOString().split('T')[0];

    let allTransactions = [];
    let offset = 0;
    let total = null;

    do {
      const response = await plaidClient.transactionsGet({
        access_token: linkedAccount.access_token,
        start_date: startDate,
        end_date: endDate,
        options: { count: 500, offset },
      });
      allTransactions = allTransactions.concat(response.data.transactions);
      total = response.data.total_transactions;
      offset += response.data.transactions.length;
    } while (offset < total);

    // Update existing transactions with their Plaid IDs
const update = db.prepare(`
      UPDATE transactions
      SET plaid_transaction_id = ?
      WHERE transaction_date = ?
        AND description = ?
        AND account = ?
        AND plaid_transaction_id IS NULL
    `);

    let updated = 0;
    const updateMany = db.transaction(() => {
      for (const t of allTransactions) {
        const storedAmount = t.amount < 0 ? Math.abs(t.amount) : -Math.abs(t.amount);
const result = update.run(
          t.transaction_id,
          t.date,
          t.name,
          account_id
        );
        if (result.changes > 0) updated++;
      }
    });
    updateMany();

// Debug — show first 3 transactions from Plaid and first 3 from DB
    const dbSample = db.prepare(`SELECT transaction_date, description, account FROM transactions LIMIT 3`).all();
    const plaidSample = allTransactions.slice(0, 3).map(t => ({ date: t.date, name: t.name, account_id }));
    return NextResponse.json({ success: true, updated, dbSample, plaidSample });
  } catch (error) {
    console.error('Update IDs error:', error.response?.data ?? error.message);
    return NextResponse.json({ error: 'Failed to update transaction IDs' }, { status: 500 });
  }
}