// app/api/plaid/sync/route.js

import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid';
import Database from 'better-sqlite3';
import path from 'path';
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
const db = new Database(path.join(process.cwd(), 'money_manager.db'));

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

function mapCategory(primary, detailed, type) {
  const d = (detailed ?? '').toUpperCase();
  const p = (primary ?? '').toUpperCase();
  const t = (type ?? '').toUpperCase();

  if (t === 'TRANSFER' || p === 'TRANSFER_IN' || p === 'TRANSFER_OUT' ||
      d.includes('TRANSFER') || d.includes('PAYMENT_INTERBANK')) return 'Transfer';

  if (p === 'CASH_WITHDRAWAL' || d.includes('ATM') || d.includes('WITHDRWL') ||
      d.includes('CASH') || (p === 'BANK_FEES' && d.includes('ATM'))) return 'Withdrawal';

  if (d.includes('GROCERIES') || d.includes('SUPERMARKET')) return 'Groceries';
  if (p === 'FOOD_AND_DRINK') return 'Food & Drink';

  if (d.includes('GAS') || d.includes('FUEL') || d.includes('PETROL')) return 'Gas';

  if (d.includes('UTILITIES') || d.includes('ELECTRIC') || d.includes('WATER') ||
      d.includes('INTERNET') || d.includes('PHONE') || d.includes('CABLE') ||
      d.includes('SUBSCRIPTION')) return 'Bills & Utilities';

  if (p === 'TRAVEL' || d.includes('AIRLINE') || d.includes('HOTEL') ||
      d.includes('LODGING') || d.includes('CAR_RENTAL') ||
      d.includes('TAXI') || d.includes('RIDE')) return 'Travel';

  if (p === 'RECREATION' || d.includes('ENTERTAINMENT') || d.includes('SPORT') ||
      d.includes('GYM') || d.includes('MOVIE') || d.includes('MUSIC') ||
      d.includes('STREAMING')) return 'Entertainment';

  if (p === 'SHOPS' || d.includes('SHOP') || d.includes('RETAIL') ||
      d.includes('CLOTHING') || d.includes('ELECTRONICS')) return 'Shopping';

  if (d.includes('HOME') || d.includes('FURNITURE') || d.includes('HARDWARE') ||
      d.includes('GARDEN') || d.includes('RENT') ||
      d.includes('MORTGAGE')) return 'Home';

  if (p === 'HEALTHCARE' || d.includes('MEDICAL') || d.includes('PHARMACY') ||
      d.includes('DOCTOR') || d.includes('DENTIST') || d.includes('PERSONAL_CARE') ||
      d.includes('SALON') || d.includes('SPA')) return 'Personal';

  if (p === 'SERVICE' || d.includes('LEGAL') || d.includes('ACCOUNTING') ||
      d.includes('INSURANCE') || d.includes('PROFESSIONAL')) return 'Professional Services';

  if (p === 'BANK_FEES' || p === 'INTEREST' || p === 'PAYMENT' ||
      p === 'CASH_ADVANCE' ||
      d.includes('FEE') || d.includes('FINE') ||
      d.includes('PENALTY')) return 'Fees & Adjustments';

  return null;
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { account_id } = await request.json();

    // Verify the account belongs to this user
    const linkedAccount = db.prepare(`
      SELECT access_token, cursor FROM linked_accounts
      WHERE account_id = ? AND user_id = ?
    `).get(account_id, userId);

    if (!linkedAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    let cursor = linkedAccount.cursor ?? null;
    let added = [];
    let hasMore = true;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: linkedAccount.access_token,
        cursor: cursor ?? undefined,
      });

      added = added.concat(response.data.added);
      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }

    // Filter to only keep transactions from the linked account
    added = added.filter(t => t.account_id === account_id);

    const insert = db.prepare(`
      INSERT INTO transactions
        (transaction_date, post_date, description, category, amount, account, type, plaid_transaction_id, user_id)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM transactions WHERE plaid_transaction_id = ?
      )
    `);

    const insertMany = db.transaction(() => {
      for (const t of added) {
        const primary = t.personal_finance_category?.primary ?? t.category?.[0] ?? '';
        const detailed = t.personal_finance_category?.detailed ?? t.category?.[1] ?? '';
        const mappedCategory = mapCategory(primary, detailed, t.transaction_type);

        const isCredit = t.amount < 0;
        const storedAmount = isCredit ? Math.abs(t.amount) : -Math.abs(t.amount);
        const autoType = isCredit ? 'credit' : 'expense';
        const creditCategory = isCredit ? 'Income' : mappedCategory;

        insert.run(
          t.date,
          t.date,
          t.name,
          creditCategory,
          storedAmount,
          account_id,
          autoType,
          t.transaction_id,
          userId,
          t.transaction_id
        );
      }
    });

    insertMany();

    // Update cursor and last synced
    db.prepare(`
      UPDATE linked_accounts SET cursor = ?, last_synced = datetime('now')
      WHERE account_id = ? AND user_id = ?
    `).run(cursor, account_id, userId);

    return NextResponse.json({ success: true, added: added.length });
  } catch (error) {
    console.error('Plaid sync error:', error.response?.data ?? error.message);
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  }
}