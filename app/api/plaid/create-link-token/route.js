// app/api/plaid/create-link-token/route.js

import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import sql from '../../../../lib/db';

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

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    // Body is optional — the "Connect a bank" button sends none
    const body = await request.json().catch(() => ({}));
    const account_id = body?.account_id ?? null;

    const baseRequest = {
      user: { client_user_id: String(userId) },
      client_name: 'Money Manager',
      country_codes: ['US'],
      language: 'en',
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    };

    let linkRequest;

    if (account_id) {
      // Update mode: re-login to an existing connection
      const rows = await sql`
        SELECT access_token FROM linked_accounts
        WHERE account_id = ${account_id} AND user_id = ${userId}
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      // Update mode uses the saved access_token and does not send products
      linkRequest = { ...baseRequest, access_token: rows[0].access_token };
    } else {
      // Normal mode: connect a brand-new bank
      linkRequest = { ...baseRequest, products: ['transactions'] };
    }

    const response = await plaidClient.linkTokenCreate(linkRequest);

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid link token error:', error.response?.data ?? error.message);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}