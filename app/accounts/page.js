// app/accounts/page.js

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [syncResults, setSyncResults] = useState({});
  const [linkReady, setLinkReady] = useState(false);
  const [linkHandler, setLinkHandler] = useState(null);

  useEffect(() => {
    fetchAccounts();
    loadPlaidScript();
  }, []);

  function fetchAccounts() {
    fetch('/api/plaid/accounts')
      .then(res => res.json())
      .then(data => {
        setAccounts(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }

  function loadPlaidScript() {
    if (document.getElementById('plaid-link-script')) {
      setLinkReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'plaid-link-script';
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = () => setLinkReady(true);
    document.body.appendChild(script);
  }

  async function handleConnectBank() {
    // Get a link token from our API
    const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
    const { link_token } = await res.json();

    // Open the Plaid Link widget
    const handler = window.Plaid.create({
      token: link_token,
      onSuccess: async (public_token, metadata) => {
        // Exchange the public token for an access token and save accounts
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token, metadata }),
        });
        fetchAccounts();
      },
      onExit: (err) => {
        if (err) console.error('Plaid Link exit error:', err);
      },
    });

    handler.open();
  }
  async function handleUpdateIds(accountId) {
    setSyncing(accountId);
    const res = await fetch('/api/plaid/update-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId }),
    });
    const data = await res.json();
    setSyncResults(prev => ({ ...prev, [accountId]: `IDs updated: ${data.updated}` }));
    setSyncing(null);
  }
async function handleHistorical(accountId) {
    setSyncing(accountId);
    setSyncResults(prev => ({ ...prev, [accountId]: null }));

    const res = await fetch('/api/plaid/historical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId }),
    });

    const data = await res.json();
    setSyncResults(prev => ({ ...prev, [accountId]: data.total ?? 0 }));
    setSyncing(null);
  }
  async function handleSync(accountId) {
    setSyncing(accountId);
    setSyncResults(prev => ({ ...prev, [accountId]: null }));

    const res = await fetch('/api/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId }),
    });

    const data = await res.json();
    setSyncResults(prev => ({ ...prev, [accountId]: data.added ?? 0 }));
    setSyncing(null);
  }

  // Group accounts by institution
  const grouped = accounts.reduce((acc, account) => {
    if (!acc[account.institution_name]) acc[account.institution_name] = [];
    acc[account.institution_name].push(account);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-gray-50 p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">← Back to dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-800">Linked Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Connect your bank accounts via Plaid to sync transactions automatically</p>
        </div>
        <button
          onClick={handleConnectBank}
          disabled={!linkReady}
className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap"
        >
          {linkReady ? '+ Connect a bank' : 'Loading...'}
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading accounts...</p>}

      {!loading && accounts.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <p className="text-2xl mb-2">🏦</p>
          <p className="text-gray-600 font-medium mb-1">No accounts connected yet</p>
          <p className="text-sm text-gray-400 mb-4">Click "Connect a bank" to link your first account</p>
        </div>
      )}

      {/* Accounts grouped by institution */}
      {Object.entries(grouped).map(([institution, institutionAccounts]) => (
        <div key={institution} className="bg-white rounded-xl shadow mb-4 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">🏦 {institution}</h2>
          </div>
          {institutionAccounts.map(account => (
<div key={account.account_id} className="flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{account.account_name}</p>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{account.account_type} — {account.account_subtype}</p>
                {account.last_synced && (
                  <p className="text-xs text-gray-300 mt-0.5">Last synced: {new Date(account.last_synced).toLocaleString()}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {syncResults[account.account_id] !== undefined && syncResults[account.account_id] !== null && (
                  <span className="text-xs text-green-600 font-medium">
                    ✓ {syncResults[account.account_id]} new transaction{syncResults[account.account_id] !== 1 ? 's' : ''} imported
                  </span>
                )}
                <button
                  onClick={() => handleHistorical(account.account_id)}
                  disabled={syncing === account.account_id}
                  className="bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-700 px-4 py-1.5 rounded-lg text-xs font-medium"
                >
                  {syncing === account.account_id ? 'Pulling...' : '↓ 2yr history'}
                </button>
                <button
                  onClick={() => handleUpdateIds(account.account_id)}
                  disabled={syncing === account.account_id}
                  className="bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 text-yellow-700 px-4 py-1.5 rounded-lg text-xs font-medium"
                >
                  Fix IDs
                </button>
                <button
                  onClick={() => handleSync(account.account_id)}
                  disabled={syncing === account.account_id}
                  className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-4 py-1.5 rounded-lg text-xs font-medium"
                >
                  {syncing === account.account_id ? 'Syncing...' : 'Sync transactions'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

    </main>
  );
}