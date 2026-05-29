// app/spending/page.js

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePreferences } from '../context/preferences';


function SpendingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

const { currency_symbol, default_date_range } = usePreferences();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  function getDefaultDates(preference) {
    const t = new Date();
    switch (preference) {
      case 'last_30':
        return {
          start: new Date(t.setDate(t.getDate() - 30)).toISOString().split('T')[0],
          end: todayStr,
        };
      case 'last_90':
        return {
          start: new Date(t.setDate(t.getDate() - 90)).toISOString().split('T')[0],
          end: todayStr,
        };
      case 'current_year':
        return {
          start: `${today.getFullYear()}-01-01`,
          end: `${today.getFullYear()}-12-31`,
        };
      default: // current_month
        return {
          start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
          end: todayStr,
        };
    }
  }

const [startDate, setStartDate] = useState(searchParams.get('start') ?? '');
  const [endDate, setEndDate] = useState(searchParams.get('end') ?? '');

  useEffect(() => {
    if (!searchParams.get('start') && !searchParams.get('end') && default_date_range) {
      const defaults = getDefaultDates(default_date_range);
      setStartDate(defaults.start);
      setEndDate(defaults.end);
    }
  }, [default_date_range]);
    const [filterCategory, setFilterCategory] = useState(searchParams.get('category') ?? '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function fetchSpending(start, end) {
    if (!start || !end) return;
    setLoading(true);
    setHasSearched(true);
const res = await fetch(`/api/spending?start=${start}&end=${end}`);
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchSpending(startDate, endDate);
    }
  }, [startDate, endDate]);

  function handleSearch() {
    fetchSpending(startDate, endDate);
  }

  function handleRowClick(category) {
router.push(`/transactions?category=${encodeURIComponent(category)}&start=${startDate}&end=${endDate}`);
  }

  // Filter results if a category was passed in from dashboard
  const displayResults = filterCategory
    ? results.filter(r => r.category === filterCategory)
    : results;

  const total = displayResults.reduce((sum, r) => sum + r.total_spent, 0);
  const grandTotal = results.reduce((sum, r) => sum + r.total_spent, 0);

  return (
    <main style={{ padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif', maxWidth: '700px', margin: '0 auto' }}>

      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: '0.75rem' }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 4px' }}>Spending Tracker</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>See what you spent by category over any date range. Click a row to see transactions.</p>
      </div>

      {/* Date range + category filter */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280' }}>From</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '14px', border: '0.5px solid #d1d5db', borderRadius: '6px', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280' }}>To</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '14px', border: '0.5px solid #d1d5db', borderRadius: '6px', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280' }}>Category</label>
          <input
            type="text"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            placeholder="All"
            style={{ padding: '6px 10px', fontSize: '14px', border: '0.5px solid #d1d5db', borderRadius: '6px', outline: 'none', width: '130px' }}
          />
        </div>
        <button
          onClick={handleSearch}
          style={{ padding: '7px 20px', fontSize: '14px', fontWeight: '500', backgroundColor: '#854F0B', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Search
        </button>
        {filterCategory && (
          <button
            onClick={() => setFilterCategory('')}
            style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear filter
          </button>
        )}
      </div>

      {loading && <p style={{ fontSize: '14px', color: '#6b7280' }}>Loading...</p>}

      {!loading && hasSearched && displayResults.length === 0 && (
        <p style={{ fontSize: '14px', color: '#6b7280' }}>No spending found for this date range.</p>
      )}

      {!loading && displayResults.length > 0 && (
        <>
          {filterCategory && (
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
              Showing <strong>{filterCategory}</strong> — {currency_symbol}{total.toFixed(2)} of {currency_symbol}{grandTotal.toFixed(2)} total
            </p>
          )}

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px', gap: '12px', padding: '0 0 8px', borderBottom: '0.5px solid #e5e7eb', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Category</span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textAlign: 'right' }}>Total spent</span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textAlign: 'right' }}>% of total</span>
          </div>

          {displayResults.map(row => {
            const pct = grandTotal > 0 ? ((row.total_spent / grandTotal) * 100).toFixed(1) : '0.0';
            const barWidth = grandTotal > 0 ? (row.total_spent / grandTotal) * 100 : 0;

            return (
              <div
                key={row.category}
                onClick={() => handleRowClick(row.category)}
                style={{ padding: '10px 0', borderBottom: '0.5px solid #f3f4f6', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px', gap: '12px', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#185FA5', textDecoration: 'underline' }}>{row.category}</span>
                  <span style={{ fontSize: '14px', textAlign: 'right', color: '#374151' }}>{currency_symbol}{row.total_spent.toFixed(2)}</span>
                  <span style={{ fontSize: '13px', textAlign: 'right', color: '#6b7280' }}>{pct}%</span>
                </div>
                <div style={{ height: '4px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
<div style={{ height: '100%', width: `${barWidth}%`, backgroundColor: '#FAC775', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            );
          })}

          {/* Total row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px', gap: '12px', padding: '14px 0 0', marginTop: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#111' }}>Total</span>
            <span style={{ fontSize: '14px', fontWeight: '600', textAlign: 'right', color: '#111' }}>{currency_symbol}{total.toFixed(2)}</span>
            <span />
          </div>
        </>
      )}
    </main>
  );
}

export default function SpendingPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading...</div>}>
      <SpendingInner />
    </Suspense>
  );
}