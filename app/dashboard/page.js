// app/dashboard/page.js

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePreferences } from '../context/preferences';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [wiggling, setWiggling] = useState(null);
  const donutRef = useRef(null);
  const animFrameRef = useRef(null);

const { currency_symbol } = usePreferences();
  const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const shortMonthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function formatMonth(m) {
    const [year, mon] = m.split('-');
    return `${monthNames[parseInt(mon, 10) - 1]} ${year}`;
  }

async function fetchData(month) {
    setLoading(true);
    const [res, incomeRes] = await Promise.all([
      fetch(`/api/dashboard?month=${month}`),
      fetch(`/api/reports?report=income_for_month&month=${month}`),
    ]);
    const json = await res.json();
    const incomeJson = await incomeRes.json();
    setData(json);
    setMonthIncome(incomeJson.total_income ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    fetchData(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (data && donutRef.current) {
      drawDonut(data.categoryData, hoveredSlice, wiggling);
    }
  }, [data, hoveredSlice, wiggling]);

  function getSlices(categories) {
    const total = categories.reduce((sum, c) => sum + c.total_spent, 0);
    if (total === 0) return [];
    let startAngle = -Math.PI / 2;
    return categories.map(cat => {
      const slice = (cat.total_spent / total) * 2 * Math.PI;
      const s = { cat, startAngle, endAngle: startAngle + slice, total };
      startAngle += slice;
      return s;
    });
  }

  function drawDonut(categories, hovered, wiggle) {
    const canvas = donutRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 16;
    const innerR = outerR * 0.55;

    ctx.clearRect(0, 0, size, size);

    const slices = getSlices(categories);
    const total = categories.reduce((sum, c) => sum + c.total_spent, 0);

    slices.forEach(({ cat, startAngle, endAngle }) => {
      const isHovered = hovered === cat.category;
      const isWiggling = wiggle === cat.category;
      const offset = isHovered || isWiggling ? 10 : 0;
      const midAngle = (startAngle + endAngle) / 2;
      const ox = Math.cos(midAngle) * offset;
      const oy = Math.sin(midAngle) * offset;

      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy);
      ctx.arc(cx + ox, cy + oy, outerR, startAngle, endAngle);
      ctx.lineTo(cx + ox, cy + oy);
      ctx.closePath();
      ctx.fillStyle = cat.colour;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = '#f9fafb';
    ctx.fill();

    // Centre text
    if (hovered) {
      const cat = categories.find(c => c.category === hovered);
      if (cat) {
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
ctx.fillText(`${currency_symbol}${cat.total_spent.toFixed(0)}`, cx, cy - 12);
        ctx.font = '11px system-ui';
        ctx.fillStyle = '#6b7280';
        const label = cat.category.length > 14 ? cat.category.slice(0, 13) + '…' : cat.category;
        ctx.fillText(label, cx, cy + 6);
        const pct = ((cat.total_spent / total) * 100).toFixed(1);
        ctx.fillText(`${pct}%`, cx, cy + 20);
      }
    } else {
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
ctx.fillText(`${currency_symbol}${total.toFixed(0)}`, cx, cy - 10);
      ctx.font = '12px system-ui';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('total spent', cx, cy + 10);
    }
  }

  function getHoveredCategory(e, categories) {
    const canvas = donutRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 16;
    const innerR = outerR * 0.55;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < innerR || dist > outerR) return null;

    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI / 2) angle += 2 * Math.PI;

    const slices = getSlices(categories);
    for (const { cat, startAngle, endAngle } of slices) {
      const adjustedStart = startAngle < -Math.PI / 2 ? startAngle + 2 * Math.PI : startAngle;
      const adjustedEnd = endAngle < -Math.PI / 2 ? endAngle + 2 * Math.PI : endAngle;
      if (angle >= adjustedStart && angle <= adjustedEnd) return cat.category;
    }
    return null;
  }

  function handleMouseMove(e) {
    if (!data) return;
    const cat = getHoveredCategory(e, data.categoryData);
    setHoveredSlice(cat);
    donutRef.current.style.cursor = cat ? 'pointer' : 'default';
  }

  function handleMouseLeave() {
    setHoveredSlice(null);
  }

  function handleCanvasClick(e) {
    if (!data) return;
    const cat = getHoveredCategory(e, data.categoryData);
    if (!cat) return;

    // Wiggle animation
    setWiggling(cat);
    setTimeout(() => setWiggling(null), 400);

    // Navigate to spending tracker with category + month pre-filtered
    const [year, mon] = selectedMonth.split('-').map(Number);
    const start = `${selectedMonth}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const end = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
    router.push(`/spending?category=${encodeURIComponent(cat)}&start=${start}&end=${end}`);
  }

const [monthIncome, setMonthIncome] = useState(0);
  const totalSpent = data?.categoryData?.reduce((sum, c) => sum + c.total_spent, 0) ?? 0;
  const totalBudget = data?.categoryData?.reduce((sum, c) => sum + (c.monthly_target ?? 0), 0) ?? 0;
  const remaining = totalBudget - totalSpent;

  return (
    <main className="min-h-screen bg-gray-50 p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">← Back to dashboard</Link>
<h1 className="text-3xl font-bold text-gray-800">Comparisons</h1>
        </div>
      </div>

      {/* Month selector */}
      <div className="bg-white rounded-xl shadow px-4 py-3 mb-6 flex flex-wrap gap-3 items-end">
        <label className="text-xs text-gray-500 pb-1.5">Viewing month:</label>
        <select
          value={selectedMonth.split('-')[1]}
          onChange={e => setSelectedMonth(`${selectedMonth.split('-')[0]}-${e.target.value}`)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>{monthNames[i]}</option>
          ))}
        </select>
        <select
          value={selectedMonth.split('-')[0]}
          onChange={e => setSelectedMonth(`${e.target.value}-${selectedMonth.split('-')[1]}`)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          {(() => {
            const currentYear = new Date().getFullYear();
            const years = [];
            for (let y = currentYear - 3; y <= currentYear + 2; y++) years.push(y);
            return years.map(y => <option key={y} value={y}>{y}</option>);
          })()}
        </select>
        <span className="text-xs text-gray-400 pb-1.5">— {formatMonth(selectedMonth)}</span>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}

      {!loading && data && (
        <div className="grid grid-cols-1 gap-6">

          {/* Top row */}
          <div className="grid grid-cols-3 gap-6">

            {/* Donut chart */}
            <div className="bg-white rounded-xl shadow p-5 flex flex-col items-center">
              <h2 className="text-sm font-semibold text-gray-600 mb-1 self-start">Spending by category</h2>
              <p className="text-xs text-gray-400 self-start mb-3">Hover to inspect · Click to drill down</p>
              {data.categoryData.length === 0 ? (
                <p className="text-sm text-gray-400 mt-8">No spending data for this month.</p>
              ) : (
                <>
                  <canvas
                    ref={donutRef}
                    width={220}
                    height={220}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleCanvasClick}
                  />
                  <div className="mt-4 w-full space-y-1">
                    {data.categoryData.map(cat => (
                      <div
                        key={cat.category}
                        className="flex items-center justify-between text-xs cursor-pointer rounded px-1 py-0.5"
                        style={{ backgroundColor: hoveredSlice === cat.category ? '#f3f4f6' : 'transparent' }}
                        onMouseEnter={() => setHoveredSlice(cat.category)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        onClick={() => {
                          const [year, mon] = selectedMonth.split('-').map(Number);
                          const start = `${selectedMonth}-01`;
                          const lastDay = new Date(year, mon, 0).getDate();
                          const end = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
                          router.push(`/spending?category=${encodeURIComponent(cat.category)}&start=${start}&end=${end}`);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.colour }} />
                          <span className="text-gray-600">{cat.category}</span>
                        </div>
<span className="text-gray-800 font-medium">{currency_symbol}{cat.total_spent.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Summary + budget vs actual */}
            <div className="col-span-2 flex flex-col gap-4">

{/* Summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow p-4">
                  <p className="text-xs text-gray-500 mb-1">Total spent</p>
                  <p className="text-2xl font-bold text-gray-800">{currency_symbol}{totalSpent.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow p-4">
                  <p className="text-xs text-gray-500 mb-1">Total budgeted</p>
                  <p className="text-2xl font-bold text-gray-800">{currency_symbol}{totalBudget.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow p-4">
                  <p className="text-xs text-gray-500 mb-1">Income this month</p>
                  <p className="text-2xl font-bold text-green-600">{currency_symbol}{monthIncome.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow p-4">
                  <p className="text-xs text-gray-500 mb-1">Remaining</p>
                  <p className={`text-2xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {currency_symbol}{Math.abs(remaining).toFixed(2)}
                    <span className="text-sm font-normal ml-1">{remaining < 0 ? 'over' : 'left'}</span>
                  </p>
                </div>
              </div>

{/* Budget vs actual bars */}
              <div className="bg-white rounded-xl shadow p-5 flex-1">
                <h2 className="text-sm font-semibold text-gray-600 mb-1">Budget vs actual</h2>
                <p className="text-xs text-gray-400 mb-4">Dashed outline = projected end-of-month spend</p>
                <div className="space-y-4">
                  {data.categoryData.map(cat => {
                    const target = cat.monthly_target;
                    const spent = cat.total_spent;
                    const projected = cat.projected_spend;
                    const over = target && spent > target;
                    const projectedOver = target && projected && projected > target;
                    const barColour = over ? '#ef4444' : cat.colour;
                    const spentPct = target ? Math.min((spent / target) * 100, 100) : null;

                    // For projection, cap display at 100% of bar but show actual value in label
                    const projectedPct = target && projected
                      ? Math.min((projected / target) * 100, 100)
                      : null;

                    return (
                      <div key={cat.category}>
                        {/* Row header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: '#374151' }}>{cat.category}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>
{currency_symbol}{spent.toFixed(0)} spent
                              {projected && (
                                <span style={{ color: projectedOver ? '#ef4444' : '#3B6D11' }}>
                                  {' · '}{currency_symbol}{projected.toFixed(0)} projected
                                  {projectedOver && ` (+${currency_symbol}${(projected - target).toFixed(0)} over)`}
                                </span>
                              )}
{target ? ` / ${currency_symbol}${target.toFixed(0)} budget` : ' — no budget set'}
                            </span>
                            {projected && (
                              <span style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '20px',
                                backgroundColor: projectedOver ? '#FCEBEB' : '#EAF3DE',
                                color: projectedOver ? '#791F1F' : '#27500A',
                                fontWeight: '500',
                              }}>
                                {projectedOver ? 'Over budget' : 'On track'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bar */}
                        {target ? (
                          <div style={{ position: 'relative', height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
                            {/* Actual spend bar */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: '8px',
                              width: `${spentPct}%`,
                              backgroundColor: barColour,
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }} />
                            {/* Projected dashed outline */}
                            {projectedPct && (
                              <div style={{
                                position: 'absolute',
                                top: '-1px',
                                left: 0,
                                height: '10px',
                                width: `${projectedPct}%`,
                                border: `1.5px dashed ${projectedOver ? '#ef4444' : barColour}`,
                                borderRadius: '4px',
                                opacity: 0.5,
                                pointerEvents: 'none',
                              }} />
                            )}
                          </div>
                        ) : (
                          <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

{/* Double bar chart — monthly trend */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-1">Monthly spending vs budget (last 12 months)</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-purple-400" /><span className="text-xs text-gray-500">Actual</span></div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-300" /><span className="text-xs text-gray-500">Budget</span></div>
            </div>
            {data.monthlyTrend.length === 0 ? (
              <p className="text-sm text-gray-400">Not enough data yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '240px', minWidth: `${data.monthlyTrend.length * 80}px`, padding: '0 8px' }}>
                  {(() => {
                    const max = Math.max(...data.monthlyTrend.flatMap(m => [m.total_spent, m.total_budget]));
                    return data.monthlyTrend.map(m => {
                      const spentH = max > 0 ? (m.total_spent / max) * 180 : 0;
                      const budgetH = max > 0 ? (m.total_budget / max) * 180 : 0;
                      const monthLabel = shortMonthNames[parseInt(m.month.slice(5), 10) - 1];
                      const yearLabel = m.month.slice(0, 4);
                      return (
                        <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', width: '64px' }}>
                          {/* Bars */}
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '180px' }}>
                            {/* Actual */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '180px' }}>
<span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '600', marginBottom: '3px' }}>{currency_symbol}{m.total_spent.toFixed(0)}</span>
                              <div style={{ width: '24px', height: `${Math.max(spentH, m.total_spent > 0 ? 4 : 0)}px`, backgroundColor: '#a78bfa', borderRadius: '3px 3px 0 0' }} />
                            </div>
                            {/* Budget */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '180px' }}>
<span style={{ fontSize: '10px', color: '#059669', fontWeight: '600', marginBottom: '3px' }}>{currency_symbol}{m.total_budget.toFixed(0)}</span>
                              <div style={{ width: '24px', height: `${Math.max(budgetH, m.total_budget > 0 ? 4 : 0)}px`, backgroundColor: '#6ee7b7', borderRadius: '3px 3px 0 0' }} />
                            </div>
                          </div>
                          {/* Month label */}
                          <div style={{ marginTop: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>{monthLabel}</div>
                            <div style={{ fontSize: '10px', color: '#9ca3af' }}>{yearLabel}</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
)}
          </div>
{/* Category trends — last 12 months */}
          {data.categoryTrends && data.categoryTrends.months.length > 0 && (
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-sm font-semibold text-gray-600 mb-1">Spending by category — last 12 months</h2>
              <p className="text-xs text-gray-400 mb-4">Monthly breakdown across all categories</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-gray-500 font-medium sticky left-0 bg-white">Category</th>
                      {data.categoryTrends.months.map(m => (
                        <th key={m} className="text-right py-2 px-2 text-gray-400 font-normal whitespace-nowrap">
                          {shortMonthNames[parseInt(m.slice(5), 10) - 1]} {m.slice(2, 4)}
                        </th>
                      ))}
                      <th className="text-right py-2 px-2 text-gray-500 font-medium whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categoryTrends.categories.map(category => {
                      const colourEntry = data.categoryData.find(c => c.category === category);
                      const colour = colourEntry?.colour ?? '#d1d5db';
                      const rowTotal = data.categoryTrends.months.reduce((sum, m) =>
                        sum + (data.categoryTrends.lookup[category]?.[m] ?? 0), 0
                      );

                      return (
                        <tr key={category} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-4 sticky left-0 bg-white hover:bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colour }} />
                              <span className="text-gray-700 whitespace-nowrap">{category}</span>
                            </div>
                          </td>
                          {data.categoryTrends.months.map(m => {
                            const val = data.categoryTrends.lookup[category]?.[m] ?? null;
                            return (
                              <td key={m} className="py-2 px-2 text-right text-gray-600">
                                {val !== null ? `${currency_symbol}${val.toFixed(0)}` : <span className="text-gray-200">—</span>}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-right font-medium text-gray-800">
                            {currency_symbol}{rowTotal.toFixed(0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td className="py-2 pr-4 font-semibold text-gray-700 sticky left-0 bg-white">Total</td>
                      {data.categoryTrends.months.map(m => {
                        const monthTotal = data.categoryTrends.categories.reduce((sum, cat) =>
                          sum + (data.categoryTrends.lookup[cat]?.[m] ?? 0), 0
                        );
                        return (
                          <td key={m} className="py-2 px-2 text-right font-medium text-gray-700">
                            {currency_symbol}{monthTotal.toFixed(0)}
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-right font-semibold text-gray-800">
                        {currency_symbol}{data.categoryTrends.categories.reduce((sum, cat) =>
                          sum + data.categoryTrends.months.reduce((s, m) =>
                            s + (data.categoryTrends.lookup[cat]?.[m] ?? 0), 0
                          ), 0
                        ).toFixed(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}