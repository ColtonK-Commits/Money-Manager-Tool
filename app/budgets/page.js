// app/budgets/page.js

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePreferences } from '../context/preferences';

export default function BudgetsPage() {
  const { currency_symbol } = usePreferences();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prevMonthIncome, setPrevMonthIncome] = useState(0);
  const [availableMonths, setAvailableMonths] = useState([]);

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function formatMonth(m) {
    const [year, mon] = m.split('-');
    return `${monthNames[parseInt(mon, 10) - 1]} ${year}`;
  }

  useEffect(() => {
    fetch('/api/budgets?months=true')
      .then(r => r.json())
      .then(data => setAvailableMonths(data));
  }, []);

  useEffect(() => {
    loadBudgets(selectedMonth);
  }, [selectedMonth]);

  async function loadBudgets(month) {
    setLoading(true);
    setSaved(false);

const budgetsRes = await fetch(`/api/budgets?month=${month}`);
    const budgetsData = await budgetsRes.json();

    // Use categories from the budgets API response, not transactions
    const cats = budgetsData.map(b => b.category);

    setCategories(cats);
    setBudgets(budgetsData);

    const initial = {};
    for (const b of budgetsData) {
      initial[b.category] = b.monthly_target ?? '';
    }
    setInputs(initial);
  // Fetch previous month's income
    const [year, mon] = month.split('-').map(Number);
    let prevYear = year;
    let prevMon = mon - 1;
    if (prevMon === 0) { prevMon = 12; prevYear--; }
    const prevMonth = `${prevYear}-${String(prevMon).padStart(2, '0')}`;
    const incomeRes = await fetch(`/api/reports?report=income_for_month&month=${prevMonth}`);
    const incomeData = await incomeRes.json();
    setPrevMonthIncome(incomeData.total_income ?? 0);

    setLoading(false);
  }

  function handleInput(category, value) {
    setInputs(prev => ({ ...prev, [category]: value }));
    setSaved(false);
  }

  function applySuggestion(category, suggested) {
    setInputs(prev => ({ ...prev, [category]: suggested }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const entries = Object.entries(inputs).filter(([_, v]) => v !== '' && v !== undefined);
    await Promise.all(
      entries.map(([category, monthly_target]) =>
        fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            monthly_target: parseFloat(monthly_target),
            month: selectedMonth,
          }),
        })
      )
    );
    setSaving(false);
    setSaved(true);
  }

  function getBudgetData(category) {
    return budgets.find(b => b.category === category) || {};
  }

  const totalTarget = Object.values(inputs).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  if (loading) {
    return <p style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>Loading...</p>;
  }

  return (
    <main style={{ padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif', maxWidth: '700px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: '0.75rem' }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 4px' }}>Budget</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Set monthly spending targets per category</p>
      </div>

      {/* Month selector */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ fontSize: '13px', color: '#6b7280' }}>Viewing month:</label>
        <select
          value={selectedMonth.split('-')[1]}
          onChange={e => setSelectedMonth(`${selectedMonth.split('-')[0]}-${e.target.value}`)}
          style={{ padding: '6px 12px', fontSize: '14px', border: '0.5px solid #d1d5db', borderRadius: '6px', outline: 'none', backgroundColor: '#fff' }}
        >
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>{monthNames[i]}</option>
          ))}
        </select>
        <select
          value={selectedMonth.split('-')[0]}
          onChange={e => setSelectedMonth(`${e.target.value}-${selectedMonth.split('-')[1]}`)}
          style={{ padding: '6px 12px', fontSize: '14px', border: '0.5px solid #d1d5db', borderRadius: '6px', outline: 'none', backgroundColor: '#fff' }}
        >
          {(() => {
            const currentYear = new Date().getFullYear();
            const years = [];
            for (let y = currentYear - 3; y <= currentYear + 2; y++) years.push(y);
            return years.map(y => <option key={y} value={y}>{y}</option>);
          })()}
        </select>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 130px 110px',
        gap: '12px',
        padding: '0 0 8px',
        borderBottom: '0.5px solid #e5e7eb',
        marginBottom: '8px',
      }}>
        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Category</span>
        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textAlign: 'right' }}>Spent (last 30 days)</span>
        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textAlign: 'center' }}>90-day suggestion</span>
        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textAlign: 'right' }}>Monthly target ({currency_symbol})</span>
      </div>

      {/* Category rows */}
      {categories.map(category => {
        const data = getBudgetData(category);
        const spent = data.spent_this_month ?? 0;
        const suggested = data.suggested_target ?? null;
        const target = inputs[category] ?? '';
        const overBudget = target !== '' && spent > parseFloat(target);

        return (
          <div
            key={category}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 130px 110px',
              gap: '12px',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: '0.5px solid #f3f4f6',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#111' }}>{category}</span>

            <span style={{
              fontSize: '14px',
              textAlign: 'right',
              color: overBudget ? '#b91c1c' : '#374151',
              fontWeight: overBudget ? '500' : '400',
            }}>
              {currency_symbol}{spent.toFixed(2)}
            </span>

            <div style={{ textAlign: 'center' }}>
              {suggested !== null ? (
                <button
                  onClick={() => applySuggestion(category, suggested)}
                  style={{
                    fontSize: '12px',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    border: '0.5px solid #B5D4F4',
                    backgroundColor: '#E6F1FB',
                    color: '#185FA5',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currency_symbol}{suggested.toFixed(2)} — use this
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: '#d1d5db' }}>Not enough data</span>
              )}
            </div>

            <input
              type="number"
              min="0"
              step="1"
              value={target}
              onChange={e => handleInput(category, e.target.value)}
              placeholder="—"
              style={{
                width: '100%',
                padding: '5px 8px',
                fontSize: '14px',
                border: `0.5px solid ${overBudget ? '#fca5a5' : '#d1d5db'}`,
                borderRadius: '6px',
                textAlign: 'right',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: overBudget ? '#fff7f7' : '#fff',
              }}
            />
          </div>
        );
      })}

      {/* Summary row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 130px 110px',
        gap: '12px',
        alignItems: 'center',
        padding: '12px 0 0',
        borderTop: '1px solid #e5e7eb',
        marginTop: '4px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#111' }}>Total</span>
        <span style={{ fontSize: '13px', fontWeight: '600', textAlign: 'right', color: '#374151' }}>
          {currency_symbol}{categories.reduce((sum, cat) => sum + (getBudgetData(cat).spent_this_month ?? 0), 0).toFixed(2)}
        </span>
        <span style={{ fontSize: '13px', fontWeight: '600', textAlign: 'center', color: '#374151' }}>
          {currency_symbol}{categories.reduce((sum, cat) => sum + (getBudgetData(cat).suggested_target ?? 0), 0).toFixed(2)}
        </span>
        <span style={{ fontSize: '13px', fontWeight: '600', textAlign: 'right', color: '#111' }}>
          {currency_symbol}{totalTarget.toFixed(2)}
        </span>
      </div>

{/* Income summary */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        backgroundColor: '#EAF3DE',
        borderRadius: '10px',
        border: '0.5px solid #C0DD97',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', color: '#27500A', fontWeight: '500' }}>
            Previous month income ({formatMonth((() => {
              const [year, mon] = selectedMonth.split('-').map(Number);
              let prevYear = year; let prevMon = mon - 1;
              if (prevMon === 0) { prevMon = 12; prevYear--; }
              return `${prevYear}-${String(prevMon).padStart(2, '0')}`;
            })())})
          </span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#27500A' }}>
            {currency_symbol}{prevMonthIncome.toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#27500A', fontWeight: '500' }}>
            Remaining after budget
          </span>
          <span style={{
            fontSize: '15px',
            fontWeight: '600',
            color: prevMonthIncome - totalTarget >= 0 ? '#27500A' : '#b91c1c',
          }}>
            {currency_symbol}{(prevMonthIncome - totalTarget).toFixed(2)}
            <span style={{ fontSize: '11px', fontWeight: '400', marginLeft: '4px' }}>
              {prevMonthIncome - totalTarget >= 0 ? 'remaining' : 'over income'}
            </span>
          </span>
        </div>
      </div>

      {/* Save button */}
      <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 24px',
            fontSize: '14px',
            fontWeight: '500',
            backgroundColor: '#185FA5',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : `Save ${formatMonth(selectedMonth)} budget`}
        </button>
        {saved && (
          <span style={{ fontSize: '13px', color: '#15803d' }}>✓ Saved successfully</span>
        )}
      </div>

    </main>
  );
}