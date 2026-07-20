'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MerchantsPage() {
  const [pattern, setPattern] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [results, setResults] = useState(null);
  const [reviewed, setReviewed] = useState({});
  const [savedRules, setSavedRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(null);
const [reapplyingRule, setReapplyingRule] = useState(null);

  useEffect(() => {
    fetchRules();
  }, []);

  function fetchRules() {
    fetch('/api/merchants')
      .then(res => res.json())
      .then(data => setSavedRules(data));
  }

  async function handleEditSave() {
    await fetch('/api/merchants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingRule),
    });
    setEditingRule(null);
    fetchRules();
  }

  async function handleDeleteRule(id) {
    await fetch(`/api/merchants?id=${id}`, {
      method: 'DELETE',
    });
    setConfirmDeleteRule(null);
    fetchRules();
  }

  async function handleReapply(rule) {
    setReapplyingRule(rule);
    setPattern(rule.pattern);
    setRuleName(rule.rule_name);
    setLoading(true);
    setSaved(false);
    setResults(null);
    setReviewed({});

    const res = await fetch('/api/merchants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_name: rule.rule_name, pattern: rule.pattern, reapply: true }),
    });

    const data = await res.json();
    setResults(data);
    setLoading(false);
  }

  async function handleSearch() {
    if (!pattern.trim()) return;
    setLoading(true);
    setSaved(false);
    setResults(null);
    setReviewed({});

    const res = await fetch('/api/merchants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_name: ruleName || pattern, pattern }),
    });

    const data = await res.json();
    setResults(data);
    setLoading(false);
  }

  async function handleApply() {
    const approvedIds = [
      ...results.autoApproved.map(t => t.id),
      ...results.needsReview.filter(t => reviewed[t.id] === true).map(t => t.id),
    ];
    console.log('Sending to PATCH:', { rule_name: ruleName || pattern, pattern, approvedIds, existingMerchantId: reapplyingRule?.id ?? null });

await fetch('/api/merchants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule_name: ruleName || pattern,
        pattern,
        approvedIds,
        existingMerchantId: reapplyingRule?.id ?? null,
      }),
    });

setSaved(true);
    setResults(null);
    setPattern('');
    setRuleName('');
    setReviewed({});
    setReapplyingRule(null);
    fetchRules();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Merchant Names</h1>
        <Link
          href="/transactions"
          className="text-sm text-blue-500 hover:underline"
        >
          ← Back to Transactions
        </Link>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-green-700 text-sm font-medium">
          ✓ Merchant rule saved and applied successfully!
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Create a New Rule</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Search Pattern
              <span className="ml-2 text-gray-400 font-normal">e.g. "Lidl" — finds all descriptions containing this</span>
            </label>
            <input
              type="text"
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="e.g. Lidl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Display Name
              <span className="ml-2 text-gray-400 font-normal">what it will show as in the app (leave blank to use pattern)</span>
            </label>
            <input
              type="text"
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="e.g. Lidl"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search Transactions'}
          </button>
        </div>
      </div>

      {results && (
        <div className="space-y-6">
          {reapplyingRule && (
            <div style={{ backgroundColor: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: '8px', padding: '10px 16px', marginBottom: '8px' }}>
              <p style={{ fontSize: '13px', color: '#185FA5', margin: 0 }}>
                Re-applying rule: <strong>{reapplyingRule.rule_name}</strong> — only showing transactions not yet renamed
              </p>
            </div>
          )}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-1">
              Auto-Approved
              <span className="ml-2 text-sm font-normal text-gray-400">— these will be renamed automatically</span>
            </h2>
            {results.autoApproved.length === 0 ? (
              <p className="text-sm text-gray-400 mt-3">No auto-approved matches found.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {results.autoApproved.map(t => (
                  <li key={t.id} className="flex items-center gap-3 text-sm">
                    <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
                    <span className="text-gray-700">{t.description}</span>
                    <span className="text-gray-400">→ {ruleName || pattern}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-1">
              Needs Review
              <span className="ml-2 text-sm font-normal text-gray-400">— approve or reject each one</span>
            </h2>
            {results.needsReview.length === 0 ? (
              <p className="text-sm text-gray-400 mt-3">No flagged matches — all clear!</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {results.needsReview.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-700">{t.description}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReviewed({ ...reviewed, [t.id]: true })}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${reviewed[t.id] === true ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-100'}`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setReviewed({ ...reviewed, [t.id]: false })}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${reviewed[t.id] === false ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'}`}
                      >
                        No
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={handleApply}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-medium"
          >
            Apply Rule
          </button>
        </div>
      )}

      {savedRules.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Saved Rules</h2>
          <ul className="space-y-3">
            {savedRules.map(r => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                {editingRule?.id === r.id ? (
                  <div className="flex gap-2 flex-1 mr-3">
                    <input
                      type="text"
                      value={editingRule.rule_name}
                      onChange={e => setEditingRule({ ...editingRule, rule_name: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Display name"
                    />
                    <input
                      type="text"
                      value={editingRule.pattern}
                      onChange={e => setEditingRule({ ...editingRule, pattern: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Pattern"
                    />
                    <button
                      onClick={handleEditSave}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingRule(null)}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex-1">
                    <span className="text-gray-700 font-medium">{r.rule_name}</span>
                    <span className="text-gray-400 ml-3">pattern: "{r.pattern}"</span>
                  </div>
                )}
                {editingRule?.id !== r.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingRule({ id: r.id, rule_name: r.rule_name, pattern: r.pattern })}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleReapply(r)}
                      className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium"
                    >
                      Re-apply
                    </button>
                    {confirmDeleteRule === r.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteRule(r.id)}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteRule(null)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteRule(r.id)}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}