// app/savings/page.js

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePreferences } from '../context/preferences';

const shortMonthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMonth(m) {
  const [year, mon] = m.split('-');
  return `${shortMonthNames[parseInt(mon, 10) - 1]} ${year}`;
}

export default function SavingsPage() {
  const { currency_symbol } = usePreferences();
  const [activeTab, setActiveTab] = useState('savings');

  // Savings Goals state
  const [goals, setGoals] = useState([]);
  const [archivedGoals, setArchivedGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [contributionGoal, setContributionGoal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Income Tracker state
  const [incomeByMonth, setIncomeByMonth] = useState([]);
  const [incomeBySource, setIncomeBySource] = useState([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const today = new Date();
  const firstOfYear = `${today.getFullYear()}-01-01`;
  const todayStr = today.toISOString().split('T')[0];
  const [incomeStart, setIncomeStart] = useState(firstOfYear);
  const [incomeEnd, setIncomeEnd] = useState(todayStr);

  const todayDate = new Date().toISOString().split('T')[0];

  const [newGoal, setNewGoal] = useState({
    name: '',
    target_amount: '',
    target_date: '',
  });

  const [newContribution, setNewContribution] = useState({
    amount: '',
    note: '',
    contribution_date: todayDate,
  });

  useEffect(() => {
    fetchGoals();
    fetchIncome();
  }, []);

  async function fetchGoals() {
    setLoading(true);
    const [active, archived] = await Promise.all([
      fetch('/api/savings').then(r => r.json()),
      fetch('/api/savings?archived=true').then(r => r.json()),
    ]);
    setGoals(active);
    setArchivedGoals(archived);
    setLoading(false);
  }

  async function fetchIncome() {
    setIncomeLoading(true);
    const [byMonth, bySource] = await Promise.all([
      fetch('/api/reports?report=income_by_month').then(r => r.json()),
      fetch(`/api/reports?report=income_by_source&start=${incomeStart}&end=${incomeEnd}`).then(r => r.json()),
    ]);
    setIncomeByMonth(Array.isArray(byMonth) ? byMonth : []);
    setIncomeBySource(Array.isArray(bySource) ? bySource : []);
    setIncomeLoading(false);
  }

  async function handleCreateGoal() {
    if (!newGoal.name || !newGoal.target_amount || !newGoal.target_date) return;
    await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_goal',
        name: newGoal.name,
        target_amount: parseFloat(newGoal.target_amount),
        target_date: newGoal.target_date,
      }),
    });
    setNewGoal({ name: '', target_amount: '', target_date: '' });
    setShowNewGoal(false);
    fetchGoals();
  }

  async function handleAddContribution() {
    if (!newContribution.amount || !contributionGoal) return;
    await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_contribution',
        goal_id: contributionGoal.id,
        amount: parseFloat(newContribution.amount),
        note: newContribution.note,
        contribution_date: newContribution.contribution_date,
      }),
    });
    setNewContribution({ amount: '', note: '', contribution_date: todayDate });
    setContributionGoal(null);
    fetchGoals();
  }

  async function handleArchive(goalId) {
    await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive_goal', goal_id: goalId }),
    });
    fetchGoals();
  }

  async function handleUnarchive(goalId) {
    await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unarchive_goal', goal_id: goalId }),
    });
    fetchGoals();
  }

  async function handleDelete(goalId) {
    await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_goal', goal_id: goalId }),
    });
    setConfirmDelete(null);
    fetchGoals();
  }

  async function handleDeleteContribution(contributionId) {
    await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_contribution', contribution_id: contributionId }),
    });
    fetchGoals();
  }

  const totalIncome12Months = incomeByMonth.reduce((sum, m) => sum + m.total_income, 0);
  const avgMonthlyIncome = incomeByMonth.length > 0 ? totalIncome12Months / incomeByMonth.length : 0;
  const maxIncome = Math.max(...incomeByMonth.map(m => m.total_income), 1);

  function GoalCard({ goal, archived = false }) {
    const [expanded, setExpanded] = useState(false);

    return (
      <div style={{
        backgroundColor: '#fff',
        border: '0.5px solid #e5e7eb',
        borderRadius: '12px',
        padding: '1.25rem',
        opacity: archived ? 0.75 : 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#111', margin: 0 }}>{goal.name}</h3>
              {goal.completed && (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#EAF3DE', color: '#27500A', fontWeight: '500' }}>✓ Complete</span>
              )}
              {archived && (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#F1EFE8', color: '#444441', fontWeight: '500' }}>Archived</span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
              Target: {currency_symbol}{goal.target_amount.toFixed(2)} by {goal.target_date}
              {goal.days_remaining > 0 && ` · ${goal.days_remaining} days remaining`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!archived && !goal.completed && (
              <button
                onClick={() => { setContributionGoal(goal); setNewContribution({ amount: '', note: '', contribution_date: todayDate }); }}
                style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '8px', border: '0.5px solid #B5D4F4', backgroundColor: '#E6F1FB', color: '#185FA5', cursor: 'pointer' }}
              >
                + Add
              </button>
            )}
            {!archived ? (
              <button
                onClick={() => handleArchive(goal.id)}
                style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '8px', border: '0.5px solid #d1d5db', backgroundColor: '#f9fafb', color: '#6b7280', cursor: 'pointer' }}
              >
                Archive
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleUnarchive(goal.id)}
                  style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '8px', border: '0.5px solid #d1d5db', backgroundColor: '#f9fafb', color: '#6b7280', cursor: 'pointer' }}
                >
                  Restore
                </button>
                <button
                  onClick={() => setConfirmDelete(goal.id)}
                  style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '8px', border: '0.5px solid #fca5a5', backgroundColor: '#fff7f7', color: '#b91c1c', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
            <span style={{ color: goal.completed ? '#15803d' : '#111', fontWeight: '500' }}>
              {currency_symbol}{goal.total_saved.toFixed(2)} saved
            </span>
            <span>{currency_symbol}{goal.remaining.toFixed(2)} remaining</span>
          </div>
          <div style={{ height: '10px', backgroundColor: '#f3f4f6', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${goal.progress_pct}%`,
              backgroundColor: goal.completed ? '#16a34a' : '#185FA5',
              borderRadius: '5px',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>
            <span>{goal.progress_pct}% complete</span>
            {!goal.completed && goal.days_remaining > 0 && (
              <span style={{ color: goal.on_pace ? '#15803d' : '#b91c1c' }}>
                {goal.on_pace ? '✓ On pace' : '⚠ Behind pace'} · Need {currency_symbol}{goal.daily_needed.toFixed(2)}/day
              </span>
            )}
          </div>
        </div>

        {goal.contributions.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '4px' }}
          >
            {expanded ? '▲ Hide' : '▼ Show'} {goal.contributions.length} contribution{goal.contributions.length !== 1 ? 's' : ''}
          </button>
        )}

        {expanded && (
          <div style={{ marginTop: '10px', borderTop: '0.5px solid #f3f4f6', paddingTop: '10px' }}>
            {goal.contributions.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #f9fafb' }}>
                <div>
                  <span style={{ fontSize: '13px', color: '#374151' }}>{currency_symbol}{c.amount.toFixed(2)}</span>
                  {c.note && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>{c.note}</span>}
                  <span style={{ fontSize: '11px', color: '#d1d5db', marginLeft: '8px' }}>{c.contribution_date}</span>
                </div>
                <button
                  onClick={() => handleDeleteContribution(c.id)}
                  style={{ fontSize: '11px', color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">← Back to dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-800">Savings & Income</h1>
          <p className="text-sm text-gray-500 mt-1">Track your savings goals and income history</p>
        </div>
        {activeTab === 'savings' && (
          <button
            onClick={() => setShowNewGoal(true)}
            style={{ backgroundColor: '#16a34a', color: '#fff', padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}
          >
            + New goal
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        {[
          { id: 'savings', label: '🐷 Savings Goals' },
          { id: 'income', label: '💰 Income Tracker' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? '#185FA5' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #185FA5' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Savings Goals Tab */}
      {activeTab === 'savings' && (
        <>
          {loading && <p className="text-sm text-gray-400">Loading...</p>}

          {!loading && goals.length === 0 && (
            <div className="bg-white rounded-xl shadow p-8 text-center mb-4">
              <p className="text-2xl mb-2">🐷</p>
              <p className="text-gray-600 font-medium mb-1">No savings goals yet</p>
              <p className="text-sm text-gray-400">Click "+ New goal" to get started</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {goals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
          </div>

          {archivedGoals.length > 0 && (
            <div>
              <button
                onClick={() => setShowArchived(o => !o)}
                className="text-sm text-gray-400 hover:text-gray-600 underline mb-4 block"
              >
                {showArchived ? '▲ Hide' : '▼ Show'} {archivedGoals.length} archived goal{archivedGoals.length !== 1 ? 's' : ''}
              </button>
              {showArchived && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {archivedGoals.map(goal => <GoalCard key={goal.id} goal={goal} archived />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Income Tracker Tab */}
      {activeTab === 'income' && (
        <>
          {incomeLoading ? (
            <p className="text-sm text-gray-400">Loading income data...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div className="bg-white rounded-xl shadow p-4">
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total income (12 months)</p>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: '#15803d', margin: 0 }}>{currency_symbol}{totalIncome12Months.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow p-4">
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Monthly average</p>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: '#15803d', margin: 0 }}>{currency_symbol}{avgMonthlyIncome.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow p-4">
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Months tracked</p>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: '#374151', margin: 0 }}>{incomeByMonth.length}</p>
                </div>
              </div>

              {/* Bar chart */}
              <div className="bg-white rounded-xl shadow p-5">
                <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 16px' }}>Monthly income — last 12 months</h2>
                {incomeByMonth.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>No income data yet — make sure income transactions are tagged with the Income category.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px', minWidth: `${incomeByMonth.length * 70}px`, padding: '0 8px' }}>
                      {incomeByMonth.map(m => {
                        const barH = maxIncome > 0 ? (m.total_income / maxIncome) * 160 : 0;
                        const monthLabel = shortMonthNames[parseInt(m.month.slice(5), 10) - 1];
                        const yearLabel = m.month.slice(2, 4);
                        return (
                          <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', width: '56px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '160px' }}>
                              <span style={{ fontSize: '10px', color: '#15803d', fontWeight: '600', marginBottom: '3px' }}>{currency_symbol}{m.total_income.toFixed(0)}</span>
                              <div style={{ width: '32px', height: `${Math.max(barH, m.total_income > 0 ? 4 : 0)}px`, backgroundColor: '#86efac', borderRadius: '3px 3px 0 0' }} />
                            </div>
                            <div style={{ marginTop: '6px', textAlign: 'center' }}>
                              <div style={{ fontSize: '11px', fontWeight: '500', color: '#374151' }}>{monthLabel}</div>
                              <div style={{ fontSize: '9px', color: '#9ca3af' }}>{yearLabel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Income by source table */}
              <div className="bg-white rounded-xl shadow p-5">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>Income by source</h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="date"
                      value={incomeStart}
                      onChange={e => setIncomeStart(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '12px', border: '0.5px solid #d1d5db', borderRadius: '6px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>to</span>
                    <input
                      type="date"
                      value={incomeEnd}
                      onChange={e => setIncomeEnd(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '12px', border: '0.5px solid #d1d5db', borderRadius: '6px' }}
                    />
                    <button
                      onClick={fetchIncome}
                      style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#185FA5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Update
                    </button>
                  </div>
                </div>
                {incomeBySource.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>No income found for this date range.</p>
                ) : (
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '6px 0', color: '#6b7280', fontWeight: '500', fontSize: '11px', textTransform: 'uppercase' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: '500', fontSize: '11px', textTransform: 'uppercase' }}>Source</th>
                        <th style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: '500', fontSize: '11px', textTransform: 'uppercase' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomeBySource.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 0', color: '#9ca3af' }}>{r.transaction_date}</td>
                          <td style={{ padding: '8px', color: '#374151' }}>{r.source}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', color: '#15803d', fontWeight: '500' }}>{currency_symbol}{r.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td colSpan={2} style={{ padding: '8px 0', fontWeight: '600', color: '#374151' }}>Total</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '600', color: '#15803d' }}>
                          {currency_symbol}{incomeBySource.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

            </div>
          )}
        </>
      )}

      {/* New goal modal */}
      {showNewGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">New savings goal</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Goal name</label>
                <input
                  type="text"
                  value={newGoal.name}
                  onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
                  placeholder="e.g. Holiday fund, New car, Emergency fund"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Target amount ({currency_symbol})</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newGoal.target_amount}
                  onChange={e => setNewGoal({ ...newGoal, target_amount: e.target.value })}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Target date</label>
                <input
                  type="date"
                  value={newGoal.target_date}
                  onChange={e => setNewGoal({ ...newGoal, target_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreateGoal} style={{ flex: 1, backgroundColor: '#16a34a', color: '#fff', borderRadius: '8px', padding: '8px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>Create goal</button>
              <button onClick={() => setShowNewGoal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add contribution modal */}
      {contributionGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Add contribution</h2>
            <p className="text-sm text-gray-500 mb-4">{contributionGoal.name} · {currency_symbol}{contributionGoal.remaining.toFixed(2)} remaining</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount ({currency_symbol})</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newContribution.amount}
                  onChange={e => setNewContribution({ ...newContribution, amount: e.target.value })}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={newContribution.contribution_date}
                  onChange={e => setNewContribution({ ...newContribution, contribution_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={newContribution.note}
                  onChange={e => setNewContribution({ ...newContribution, note: e.target.value })}
                  placeholder="e.g. Monthly transfer"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleAddContribution} style={{ flex: 1, backgroundColor: '#16a34a', color: '#fff', borderRadius: '8px', padding: '8px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>Save contribution</button>
              <button onClick={() => setContributionGoal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Delete goal?</h2>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete the goal and all its contributions. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Yes, delete</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}