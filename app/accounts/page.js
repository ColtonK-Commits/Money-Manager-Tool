'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [syncResults, setSyncResults] = useState({});
  const [linkReady, setLinkReady] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImport, setShowImport] = useState(false);

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
    const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
    const { link_token } = await res.json();

    const handler = window.Plaid.create({
      token: link_token,
      onSuccess: async (public_token, metadata) => {
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

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', importFile);

    const res = await fetch('/api/import', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setImportResult(data);
    setImporting(false);
    setImportFile(null);
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

  const grouped = accounts.reduce((acc, account) => {
    if (!acc[account.institution_name]) acc[account.institution_name] = [];
    acc[account.institution_name].push(account);
    return acc;
  }, {});

  const templateHref = [
    'data:text/csv;charset=utf-8,',
    'transaction_date,description,amount,category,type,memo,account',
    '%0A2026-01-15,Walmart,-52.30,Groceries,,,BOA Checking',
    '%0A2026-01-16,Salary,3000.00,Income,,,BOA Checking',
  ].join('');

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

      {/* CSV Import Section */}
      <div style={{ backgroundColor: '#fff', border: '0.5px solid #e5e7eb', borderRadius: '12px', marginBottom: '24px', overflow: 'hidden' }}>
        <div
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => setShowImport(o => !o)}
        >
          <div>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#111', margin: 0 }}>📂 Import transactions from CSV</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>Upload a formatted CSV file to import historical transactions</p>
          </div>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{showImport ? '▲ Hide' : '▼ Show'}</span>
        </div>

        {showImport && (
          <div style={{ padding: '0 20px 20px', borderTop: '0.5px solid #f3f4f6' }}>

            {/* Template download */}
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '12px 16px', marginTop: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: '500', color: '#111', margin: '0 0 6px' }}>
                Step 1 — Download the template
              </p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px' }}>
                Fill it in with your transactions and save as CSV. Required columns:{' '}
                <strong>transaction_date</strong> (YYYY-MM-DD), <strong>description</strong>,{' '}
                <strong>amount</strong> (negative for spending). Optional: category, type, memo, account.
              </p>
              
                <button
                onClick={() => {
                  const csv = 'transaction_date,description,amount,category,type,memo,account\n2026-01-15,Walmart,-52.30,Groceries,,,BOA Checking\n2026-01-16,Salary,3000.00,Income,,,BOA Checking';
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'import-template.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '6px', border: '0.5px solid #B5D4F4', backgroundColor: '#E6F1FB', color: '#185FA5', cursor: 'pointer' }}
              >
                ⬇ Download template
              </button>
            </div>

            {/* File upload */}
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', fontWeight: '500', color: '#111', margin: '0 0 8px' }}>
                Step 2 — Upload your completed CSV
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={e => { setImportFile(e.target.files[0]); setImportResult(null); }}
                style={{ fontSize: '13px', color: '#374151' }}
              />
            </div>

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={!importFile || importing}
              style={{
                fontSize: '13px',
                padding: '7px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: importFile && !importing ? '#185FA5' : '#d1d5db',
                color: '#fff',
                cursor: importFile && !importing ? 'pointer' : 'not-allowed',
                fontWeight: '500',
              }}
            >
              {importing ? 'Importing...' : 'Import transactions'}
            </button>

            {/* Result */}
            {importResult && (
              <div style={{
                marginTop: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: importResult.success ? '#EAF3DE' : '#fff7f7',
                border: `0.5px solid ${importResult.success ? '#C0DD97' : '#fca5a5'}`,
              }}>
                {importResult.success ? (
                  <>
                    <p style={{ fontSize: '13px', color: '#27500A', fontWeight: '500', margin: '0 0 4px' }}>
                      ✓ Import complete — {importResult.imported} transactions imported
                      {importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}
                    </p>
                    {importResult.errors?.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        {importResult.errors.map((e, i) => (
                          <p key={i} style={{ fontSize: '11px', color: '#b91c1c', margin: '2px 0' }}>{e}</p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: '13px', color: '#b91c1c', margin: 0 }}>✕ {importResult.error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

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