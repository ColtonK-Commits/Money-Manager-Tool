// app/api/plaid/exchange-token/route.js

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
    const { public_token, metadata } = await request.json();

    // Exchange the public token for a permanent access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;

    // Fetch account details from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const institution = metadata?.institution?.name ?? 'Unknown Bank';

    // Save each account to the database
    const insert = db.prepare(`
      INSERT OR IGNORE INTO linked_accounts
        (institution_name, account_name, account_type, account_subtype, account_id, access_token)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (const account of accountsResponse.data.accounts) {
        insert.run(
          institution,
          account.name,
          account.type,
          account.subtype,
          account.account_id,
          accessToken
        );
      }
    });

    insertMany();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Plaid exchange token error:', error.response?.data ?? error.message);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}