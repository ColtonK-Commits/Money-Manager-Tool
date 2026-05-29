// app/api/plaid/create-link-token/route.js

import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid';
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

export async function POST() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'local-user' },
      client_name: 'Money Manager',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid link token error:', error.response?.data ?? error.message);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}