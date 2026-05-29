// app/settings/page.js

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);

  // Category editing state
  const [editingCategory, setEditingCategory] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColour, setEditColour] = useState('');
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [confirmMerge, setConfirmMerge] = useState(false);

  // Account state
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(null);

  // Data management state
  const [confirmClearSandbox, setConfirmClearSandbox] = useState(false);
  const [confirmResetCursors, setConfirmResetCursors] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [cats, accs, prefs] = await Promise.all([
      fetch('/api/settings?type=categories').then(r => r.json()),
      fetch('/api/settings?type=accounts').then(r => r.json()),
      fetch('/api/settings?type=preferences').then(r => r.json()),
    ]);
    setCategories(cats);
    setAccounts(accs);
    setPreferences(prefs);
    setLoading(false);
  }

  async function post(body) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function handleRenameCategory() {
    if (!editName.trim() || editName === editingCategory.name) return;
    await post({ action: 'rename_category', old_name: editingCategory.name, new_name: editName.trim() });
    setEditingCategory(null);
    fetchAll();
  }

  async function handleUpdateColour() {
    await post({ action: 'update_colour', name: editingCategory.name, colour: editColour });
    setEditingCategory(null);
    fetchAll();
  }

  async function handleSaveCategory() {
    if (editName.trim() && editName.trim() !== editingCategory.name) {
      await post({ action: 'rename_category', old_name: editingCategory.name, new_name: editName.trim() });
    }
    if (editColour !== editingCategory.colour) {
      await post({ action: 'update_colour', name: editName.trim() || editingCategory.name, colour: editColour });
    }
    setEditingCategory(null);
    fetchAll();
  }

async function handleMerge() {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    await post({ action: 'merge_categories', source: mergeSource, target: mergeTarget });
    setConfirmMerge(false);
    setMergeSource('');
    setMergeTarget('');
    setActionResult(`✓ Merged "${mergeSource}" into "${mergeTarget}" successfully`);
    fetchAll();
  }

  async function handleDeleteCategory(name) {
    await post({ action: 'delete_category', name });
    setConfirmDeleteCategory(null);
    fetchAll();
  }

  async function handleDeleteAccount(accountId) {
    await post({ action: 'delete_account', account_id: accountId });
    setConfirmDeleteAccount(null);
    setActionResult('✓ Account and its transactions deleted');
    fetchAll();
  }

  async function handleClearSandbox() {
    await post({ action: 'clear_sandbox_data' });
    setConfirmClearSandbox(false);
    setActionResult('✓ Sandbox transactions cleared and cursors reset');
    fetchAll();
  }

  async function handleResetCursors() {
    await post({ action: 'reset_cursors' });
    setConfirmResetCursors(false);
    setActionResult('✓ Plaid cursors reset — re-sync to pull all transactions');
  }

  async function handleSavePreference(key, value) {
    await post({ action: 'save_preference', key, value });
    setPreferences(prev => ({ ...prev, [key]: value }));
  }

  const cardStyle = {
    backgroundColor: '#fff',
    border: '0.5px solid #e5e7eb',
    borderRadius: '12px',
    padding: '1.25rem',
    marginBottom: '16px',
  };

  const sectionTitle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111',
    margin: '0 0 4px',
  };

  const sectionSubtitle = {
    fontSize: '12px',
    color: '#6b7280',
    margin: '0 0 16px',
  };

  if (loading) return <p style={{ padding: '2rem', fontFamily: 'system-ui' }}>Loading...</p>;

  return (
    <main className="min-h-screen bg-gray-50 p-6" style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">← Back to dashboard</Link>
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage categories, accounts, and preferences</p>
      </div>

      {/* Action result banner */}
      {actionResult && (
        <div style={{ backgroundColor: '#EAF3DE', border: '0.5px solid #C0DD97', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#27500A' }}>{actionResult}</span>
          <button onClick={() => setActionResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B6D11', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {/* 1. Category Management */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Category management</p>
        <p style={sectionSubtitle}>Rename, recolour, or delete categories. Changes apply to all transactions and budgets.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '0.5px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: cat.colour, display: 'inline-block' }} />
                <span style={{ fontSize: '13px', color: '#111' }}>{cat.name}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{cat.transaction_count} transactions</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => { setEditingCategory(cat); setEditName(cat.name); setEditColour(cat.colour); }}
                  style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '0.5px solid #d1d5db', backgroundColor: '#fff', color: '#374151', cursor: 'pointer' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDeleteCategory(cat)}
                  style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '0.5px solid #fca5a5', backgroundColor: '#fff7f7', color: '#b91c1c', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
</div>
      </div>

      {/* Merge categories — separate danger card */}
      <div style={{ ...cardStyle, border: '0.5px solid #fca5a5' }}>
        <p style={{ ...sectionSubtitle }}>Moves all transactions from one category into another and deletes the source. This cannot be undone.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={mergeSource} onChange={e => setMergeSource(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '13px', border: '0.5px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff' }}>
            <option value="">Source category</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>→ into</span>
          <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '13px', border: '0.5px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff' }}>
            <option value="">Target category</option>
            {categories.filter(c => c.name !== mergeSource).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <button
            onClick={() => { if (mergeSource && mergeTarget) setConfirmMerge(true); }}
            disabled={!mergeSource || !mergeTarget}
            style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '6px', border: '0.5px solid #fca5a5', backgroundColor: mergeSource && mergeTarget ? '#fff7f7' : '#f9fafb', color: mergeSource && mergeTarget ? '#b91c1c' : '#9ca3af', cursor: mergeSource && mergeTarget ? 'pointer' : 'not-allowed' }}
          >
            Merge
          </button>
        </div>
      </div>

      {/* 2. Linked Accounts */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={sectionTitle}>Linked accounts</p>
            <p style={{ ...sectionSubtitle, margin: 0 }}>Manage your connected bank accounts</p>
          </div>
          <Link href="/accounts" style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none', padding: '4px 12px', border: '0.5px solid #B5D4F4', borderRadius: '6px', backgroundColor: '#E6F1FB' }}>
            Manage accounts →
          </Link>
        </div>

        {accounts.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>No accounts linked yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '0.5px solid #f3f4f6' }}>
                <div>
                  <span style={{ fontSize: '13px', color: '#111' }}>{acc.institution_name} — {acc.account_name}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px', textTransform: 'capitalize' }}>{acc.account_type}</span>
                </div>
                <button
                  onClick={() => setConfirmDeleteAccount(acc)}
                  style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '0.5px solid #fca5a5', backgroundColor: '#fff7f7', color: '#b91c1c', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Preferences */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Preferences</p>
        <p style={sectionSubtitle}>Customise how the app displays data</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#111', margin: '0 0 2px' }}>Currency symbol</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Shown next to all amounts</p>
            </div>
            <select
              value={preferences.currency_symbol ?? '$'}
              onChange={e => handleSavePreference('currency_symbol', e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', border: '0.5px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff' }}
            >
              <option value="$">$ Dollar</option>
              <option value="€">€ Euro</option>
              <option value="£">£ Pound</option>
              <option value="¥">¥ Yen</option>
              <option value="C$">C$ Canadian Dollar</option>
              <option value="A$">A$ Australian Dollar</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#111', margin: '0 0 2px' }}>Default date range</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Used on Spending Tracker and Reports</p>
            </div>
            <select
              value={preferences.default_date_range ?? 'current_month'}
              onChange={e => handleSavePreference('default_date_range', e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', border: '0.5px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff' }}
            >
              <option value="current_month">Current month</option>
              <option value="last_30">Last 30 days</option>
              <option value="last_90">Last 90 days</option>
              <option value="current_year">Current year</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Quick Links */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Quick links</p>
        <p style={sectionSubtitle}>Jump to other management pages</p>
        <Link href="/merchants" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#185FA5', textDecoration: 'none', padding: '6px 14px', border: '0.5px solid #B5D4F4', borderRadius: '8px', backgroundColor: '#E6F1FB' }}>
          🏪 Merchant name rules →
        </Link>
      </div>

      {/* 5. Data Management */}
      <div style={{ ...cardStyle, border: '0.5px solid #fca5a5' }}>
        <p style={{ ...sectionTitle, color: '#b91c1c' }}>Data management</p>
        <p style={sectionSubtitle}>Danger zone — these actions cannot be undone</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fff7f7', borderRadius: '8px', border: '0.5px solid #fecaca' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#111', margin: '0 0 2px' }}>Clear sandbox data</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Deletes all Plaid-synced transactions and resets cursors</p>
            </div>
            <button
              onClick={() => setConfirmClearSandbox(true)}
              style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '6px', border: '0.5px solid #fca5a5', backgroundColor: '#fff', color: '#b91c1c', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Clear sandbox data
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fff7f7', borderRadius: '8px', border: '0.5px solid #fecaca' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#111', margin: '0 0 2px' }}>Reset Plaid cursors</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Keeps transactions but allows full re-sync from Plaid</p>
            </div>
            <button
              onClick={() => setConfirmResetCursors(true)}
              style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '6px', border: '0.5px solid #fca5a5', backgroundColor: '#fff', color: '#b91c1c', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Reset cursors
            </button>
          </div>
        </div>
      </div>

      {/* Confirm merge modal */}
      {confirmMerge && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Merge categories?</h2>
            <p className="text-sm text-gray-500 mb-1">
              This will move all transactions from <strong>{mergeSource}</strong> into <strong>{mergeTarget}</strong> and delete <strong>{mergeSource}</strong>.
            </p>
            <p className="text-sm text-red-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={handleMerge} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Yes, merge</button>
              <button onClick={() => setConfirmMerge(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit category modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Edit category</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Colour</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={editColour}
                    onChange={e => setEditColour(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{editColour}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveCategory} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Save</button>
              <button onClick={() => setEditingCategory(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete category modal */}
      {confirmDeleteCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Delete category?</h2>
            <p className="text-sm text-gray-500 mb-1">This will delete <strong>{confirmDeleteCategory.name}</strong> and remove it from all {confirmDeleteCategory.transaction_count} transactions and budgets.</p>
            <p className="text-sm text-red-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteCategory(confirmDeleteCategory.name)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Yes, delete</button>
              <button onClick={() => setConfirmDeleteCategory(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete account modal */}
      {confirmDeleteAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Delete account?</h2>
            <p className="text-sm text-gray-500 mb-1">This will permanently delete <strong>{confirmDeleteAccount.institution_name} — {confirmDeleteAccount.account_name}</strong> and all its synced transactions.</p>
            <p className="text-sm text-red-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteAccount(confirmDeleteAccount.account_id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Yes, delete</button>
              <button onClick={() => setConfirmDeleteAccount(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm clear sandbox modal */}
      {confirmClearSandbox && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Clear sandbox data?</h2>
            <p className="text-sm text-gray-500 mb-5">This will delete all Plaid-synced transactions and reset all cursors. Your manually imported transactions will not be affected.</p>
            <div className="flex gap-3">
              <button onClick={handleClearSandbox} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Yes, clear it</button>
              <button onClick={() => setConfirmClearSandbox(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm reset cursors modal */}
      {confirmResetCursors && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Reset Plaid cursors?</h2>
            <p className="text-sm text-gray-500 mb-5">This will reset all sync cursors. Next time you sync, Plaid will re-send all transactions. Use "Insert or Ignore" so duplicates won't be created.</p>
            <div className="flex gap-3">
              <button onClick={handleResetCursors} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Yes, reset</button>
              <button onClick={() => setConfirmResetCursors(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}