// app/api/plaid/create-link-token/route.js

import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

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

export async function POST() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: String(userId) },
      client_name: 'Money Manager',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid link token error:', error.response?.data ?? error.message);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}