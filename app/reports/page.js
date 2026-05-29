// app/reports/page.js

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePreferences } from '../context/preferences';

const shortMonthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMonth(m) {
  const [year, mon] = m.split('-');
  return `${shortMonthNames[parseInt(mon, 10) - 1]} ${year}`;
}

export default function ReportsPage() {
  const { currency_symbol, default_date_range } = usePreferences();
  const today = new Date();
  const currentYear = today.getFullYear();
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
          start: `${currentYear}-01-01`,
          end: `${currentYear}-12-31`,
        };
      default: // current_month
        return {
          start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
          end: todayStr,
        };
    }
  }

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (default_date_range) {
      const defaults = getDefaultDates(default_date_range);
      setStartDate(defaults.start);
      setEndDate(defaults.end);
    }
  }, [default_date_range]);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [topMerchants, setTopMerchants] = useState([]);
  const [biggestTx, setBiggestTx] = useState([]);
  const [categoryAverages, setCategoryAverages] = useState([]);
  const [yearOverYear, setYearOverYear] = useState(null);
  const [categoryTrends, setCategoryTrends] = useState([]);
  const [savingsRate, setSavingsRate] = useState([]);
  const [rollingAverages, setRollingAverages] = useState([]);
  const [budgetVariance, setBudgetVariance] = useState([]);
  const [recurringTx, setRecurringTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (startDate && endDate) {
      fetchAll();
    }
  }, [startDate, endDate]);

  async function fetchAll() {
    setLoading(true);
    const [merchants, biggest, averages, yoy, trends, savings, rolling, variance, recurring] = await Promise.all([
      fetch(`/api/reports?report=top_merchants&start=${startDate}&end=${endDate}`).then(r => r.json()),
      fetch(`/api/reports?report=biggest_transactions&start=${startDate}&end=${endDate}`).then(r => r.json()),
      fetch(`/api/reports?report=category_averages&start=${startDate}&end=${endDate}`).then(r => r.json()),
      fetch(`/api/reports?report=year_over_year&year=${selectedYear}`).then(r => r.json()),
      fetch('/api/reports?report=category_trends').then(r => r.json()),
      fetch('/api/reports?report=savings_rate').then(r => r.json()),
      fetch('/api/reports?report=rolling_averages').then(r => r.json()),
      fetch('/api/reports?report=budget_variance').then(r => r.json()),
      fetch('/api/reports?report=recurring').then(r => r.json()),
    ]);
    setTopMerchants(merchants);
    setBiggestTx(biggest);
    setCategoryAverages(averages);
    setYearOverYear(yoy);
    setCategoryTrends(trends);
    setSavingsRate(savings);
    setRollingAverages(rolling);
    setBudgetVariance(variance);
    setRecurringTx(Array.isArray(recurring) ? recurring : []);
    setLoading(false);
  }

  // --- Excel Export ---
  async function handleExcelExport() {
    const rows = await fetch(`/api/reports?report=export&start=${startDate}&end=${endDate}`).then(r => r.json());
    const XLSX = await import('xlsx');

    const wsData = [
      ['Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo', 'Account'],
      ...rows.map(r => [
        r.transaction_date,
        r.post_date,
        r.description,
        r.category,
        r.type,
        r.amount,
        r.memo,
        r.account,
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const summaryData = [
      ['Category', 'Total Spent', 'Monthly Avg', 'Weekly Avg'],
      ...categoryAverages.map(r => [r.category, r.total_spent, r.monthly_avg, r.weekly_avg]),
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Category Summary');

    XLSX.writeFile(wb, `money-manager-export-${startDate}-to-${endDate}.xlsx`);
  }

  // --- PDF Export ---
  async function handlePdfExport(type = 'both') {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55);
    doc.text('Money Manager', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(`${startDate} to ${endDate}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    if (type === 'transactions' || type === 'both') {
      const rows = await fetch(`/api/reports?report=export&start=${startDate}&end=${endDate}`).then(r => r.json());
      const totalSpent = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
      const totalIncome = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);

      doc.setFontSize(13);
      doc.setTextColor(31, 41, 55);
      doc.text('Transaction Summary', 14, currentY);
      currentY += 7;
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text(`Total Spent: ${currency_symbol}${totalSpent.toFixed(2)}`, 14, currentY); currentY += 6;
      doc.text(`Total Income: ${currency_symbol}${totalIncome.toFixed(2)}`, 14, currentY); currentY += 6;
      doc.text(`Net: ${currency_symbol}${(totalIncome - totalSpent).toFixed(2)}`, 14, currentY); currentY += 6;
      doc.text(`Transactions: ${rows.length}`, 14, currentY); currentY += 8;

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Description', 'Category', 'Amount']],
        body: rows.map(r => [
          r.transaction_date,
          (r.description ?? '').slice(0, 35),
          r.category ?? '',
          `${r.amount >= 0 ? '+' : '-'}${currency_symbol}${Math.abs(r.amount).toFixed(2)}`,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 80 },
          2: { cellWidth: 40 },
          3: { cellWidth: 25, halign: 'right' },
        },
      });
      currentY = doc.lastAutoTable.finalY + 12;
    }

    if (type === 'reports' || type === 'both') {
      if (type === 'both') { doc.addPage(); currentY = 20; }

      if (topMerchants.length > 0) {
        doc.setFontSize(13);
        doc.setTextColor(31, 41, 55);
        doc.text('Top Merchants by Spend', 14, currentY);
        autoTable(doc, {
          startY: currentY + 4,
          head: [['Merchant', 'Transactions', 'Total Spent']],
          body: topMerchants.slice(0, 10).map(m => [m.merchant, m.transaction_count, `${currency_symbol}${m.total_spent.toFixed(2)}`]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255 },
        });
        currentY = doc.lastAutoTable.finalY + 10;
      }

      if (categoryAverages.length > 0) {
        doc.setFontSize(13);
        doc.setTextColor(31, 41, 55);
        doc.text('Average Spend by Category', 14, currentY);
        autoTable(doc, {
          startY: currentY + 4,
          head: [['Category', 'Total', 'Monthly Avg', 'Weekly Avg', 'Daily Avg']],
          body: categoryAverages.map(r => [
            r.category,
            `${currency_symbol}${r.total_spent.toFixed(2)}`,
            `${currency_symbol}${r.monthly_avg.toFixed(2)}`,
            `${currency_symbol}${r.weekly_avg.toFixed(2)}`,
            `${currency_symbol}${r.daily_avg.toFixed(2)}`,
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255 },
        });
        currentY = doc.lastAutoTable.finalY + 10;
      }

      if (savingsRate.length > 0) {
        doc.setFontSize(13);
        doc.setTextColor(31, 41, 55);
        doc.text('Savings Rate (Last 12 Months)', 14, currentY);
        autoTable(doc, {
          startY: currentY + 4,
          head: [['Month', 'Income', 'Spending', 'Net', 'Savings Rate']],
          body: savingsRate.map(r => [
            formatMonth(r.month),
            `${currency_symbol}${r.income.toFixed(2)}`,
            `${currency_symbol}${r.spending.toFixed(2)}`,
            `${r.net >= 0 ? '+' : ''}${currency_symbol}${Math.abs(r.net).toFixed(2)}`,
            r.savings_rate !== null ? `${r.savings_rate}%` : '—',
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255 },
        });
        currentY = doc.lastAutoTable.finalY + 10;
      }

      if (budgetVariance.length > 0) {
        doc.setFontSize(13);
        doc.setTextColor(31, 41, 55);
        doc.text('Budget Variance (Last 6 Months)', 14, currentY);
        autoTable(doc, {
          startY: currentY + 4,
          head: [['Category', 'Avg Variance', ...(budgetVariance[0]?.months.map(m => formatMonth(m.month)) ?? [])]],
          body: budgetVariance.map(r => [
            r.category,
            r.avg_variance !== null ? `${r.avg_variance > 0 ? '+' : ''}${currency_symbol}${Math.abs(r.avg_variance).toFixed(2)}` : '—',
            ...r.months.map(m => m.budget > 0 ? `${m.variance > 0 ? '+' : ''}${currency_symbol}${Math.abs(m.variance).toFixed(2)}` : '—'),
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255 },
        });
      }
    }

    const suffix = type === 'transactions' ? 'transactions' : type === 'reports' ? 'reports' : 'full';
    doc.save(`money-manager-${suffix}-${startDate}-to-${endDate}.pdf`);
  }

  const years = [];
  for (let y = currentYear - 3; y <= currentYear; y++) years.push(y);

  return (
    <main className="min-h-screen bg-gray-50 p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">← Back to dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Analyse and export your financial data</p>
        </div>
      </div>

      {/* Date range + export */}
      <div className="bg-white rounded-xl shadow px-5 py-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Date range for reports & exports</h2>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <button onClick={fetchAll}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium">
            Update reports
          </button>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500 mb-3 font-medium">Export options</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleExcelExport}
              style={{ backgroundColor: '#16a34a', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>
              ⬇ Excel — Transactions + Summary
            </button>
            <button onClick={() => handlePdfExport('transactions')}
              style={{ backgroundColor: '#ef4444', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>
              ⬇ PDF — Transactions only
            </button>
            <button onClick={() => handlePdfExport('reports')}
              style={{ backgroundColor: '#ef4444', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>
              ⬇ PDF — Reports only
            </button>
            <button onClick={() => handlePdfExport('both')}
              style={{ backgroundColor: '#b91c1c', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>
              ⬇ PDF — Full report
            </button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading reports...</p> : (
        <div className="grid grid-cols-1 gap-6">

          {/* Top merchants + biggest transactions */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Top merchants by spend</h2>
              <div className="space-y-2">
                {topMerchants.slice(0, 10).map((m, i) => (
                  <div key={m.merchant} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                      <span className="text-gray-700 truncate max-w-[160px]">{m.merchant}</span>
                      <span className="text-xs text-gray-400">×{m.transaction_count}</span>
                    </div>
                    <span className="font-medium text-gray-800">{currency_symbol}{m.total_spent.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Biggest single transactions</h2>
              <div className="space-y-2">
                {biggestTx.slice(0, 10).map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                      <div>
                        <p className="text-gray-700 truncate max-w-[140px]">{t.merchant}</p>
                        <p className="text-xs text-gray-400">{t.transaction_date}</p>
                      </div>
                    </div>
                    <span className="font-medium text-gray-800">{currency_symbol}{t.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category averages */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Average spend by category</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                    <th className="text-left py-2 pr-4">Category</th>
                    <th className="text-right py-2 px-4">Total</th>
                    <th className="text-right py-2 px-4">Monthly avg</th>
                    <th className="text-right py-2 px-4">Weekly avg</th>
                    <th className="text-right py-2 px-4">Daily avg</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryAverages.map(r => (
                    <tr key={r.category} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-gray-700">{r.category}</td>
                      <td className="py-2 px-4 text-right font-medium">{currency_symbol}{r.total_spent.toFixed(2)}</td>
                      <td className="py-2 px-4 text-right text-gray-600">{currency_symbol}{r.monthly_avg.toFixed(2)}</td>
                      <td className="py-2 px-4 text-right text-gray-600">{currency_symbol}{r.weekly_avg.toFixed(2)}</td>
                      <td className="py-2 px-4 text-right text-gray-600">{currency_symbol}{r.daily_avg.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Year over year */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Year over year comparison</h2>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1 text-sm"
              >
                {years.map(y => <option key={y} value={y}>{y} vs {y - 1}</option>)}
              </select>
            </div>
            {yearOverYear && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left py-2 pr-4">Category</th>
                      <th className="text-right py-2 px-4">{yearOverYear.currentYear}</th>
                      <th className="text-right py-2 px-4">{yearOverYear.prevYear}</th>
                      <th className="text-right py-2 px-4">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearOverYear.rows.map(r => {
                      const change = r.current_year - r.prev_year;
                      const pct = r.prev_year > 0 ? ((change / r.prev_year) * 100).toFixed(1) : null;
                      return (
                        <tr key={r.category} className="border-b border-gray-50">
                          <td className="py-2 pr-4 text-gray-700">{r.category}</td>
                          <td className="py-2 px-4 text-right font-medium">{currency_symbol}{r.current_year.toFixed(2)}</td>
                          <td className="py-2 px-4 text-right text-gray-500">{currency_symbol}{r.prev_year.toFixed(2)}</td>
                          <td className={`py-2 px-4 text-right font-medium ${change > 0 ? 'text-red-500' : change < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {change > 0 ? '+' : ''}{currency_symbol}{Math.abs(change).toFixed(2)}
                            {pct && <span className="text-xs ml-1">({pct}%)</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Savings rate */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Savings rate (last 12 months)</h2>
            {savingsRate.length === 0 ? (
              <p className="text-sm text-gray-400">Not enough data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left py-2 pr-4">Month</th>
                      <th className="text-right py-2 px-4">Income</th>
                      <th className="text-right py-2 px-4">Spending</th>
                      <th className="text-right py-2 px-4">Net</th>
                      <th className="text-right py-2 px-4">Savings rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savingsRate.map(r => (
                      <tr key={r.month} className="border-b border-gray-50">
                        <td className="py-2 pr-4 text-gray-700">{formatMonth(r.month)}</td>
                        <td className="py-2 px-4 text-right text-green-600">{currency_symbol}{r.income.toFixed(2)}</td>
                        <td className="py-2 px-4 text-right text-gray-700">{currency_symbol}{r.spending.toFixed(2)}</td>
                        <td className={`py-2 px-4 text-right font-medium ${r.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {r.net >= 0 ? '+' : ''}{currency_symbol}{Math.abs(r.net).toFixed(2)}
                        </td>
                        <td className={`py-2 px-4 text-right font-medium ${r.savings_rate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {r.savings_rate !== null ? `${r.savings_rate}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rolling averages */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Rolling averages (last 12 months)</h2>
            {rollingAverages.length === 0 ? (
              <p className="text-sm text-gray-400">Not enough data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left py-2 pr-4">Month</th>
                      <th className="text-right py-2 px-4">Actual spend</th>
                      <th className="text-right py-2 px-4">3-month avg</th>
                      <th className="text-right py-2 px-4">12-month avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollingAverages.map(r => (
                      <tr key={r.month} className="border-b border-gray-50">
                        <td className="py-2 pr-4 text-gray-700">{formatMonth(r.month)}</td>
                        <td className="py-2 px-4 text-right font-medium">{currency_symbol}{r.total_spent.toFixed(2)}</td>
                        <td className="py-2 px-4 text-right text-gray-600">{currency_symbol}{r.rolling_3.toFixed(2)}</td>
                        <td className="py-2 px-4 text-right text-gray-600">{currency_symbol}{r.rolling_12.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Budget variance */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Budget variance (last 6 months)</h2>
            <p className="text-xs text-gray-400 mb-4">Positive = over budget · Negative = under budget</p>
            {budgetVariance.length === 0 ? (
              <p className="text-sm text-gray-400">Not enough data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left py-2 pr-4">Category</th>
                      <th className="text-right py-2 px-4">Avg variance</th>
                      {budgetVariance[0]?.months.map(m => (
                        <th key={m.month} className="text-right py-2 px-4">{formatMonth(m.month)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {budgetVariance.map(r => (
                      <tr key={r.category} className="border-b border-gray-50">
                        <td className="py-2 pr-4 text-gray-700">{r.category}</td>
                        <td className={`py-2 px-4 text-right font-medium ${r.avg_variance > 0 ? 'text-red-500' : r.avg_variance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {r.avg_variance !== null ? `${r.avg_variance > 0 ? '+' : ''}${currency_symbol}${Math.abs(r.avg_variance).toFixed(2)}` : '—'}
                        </td>
                        {r.months.map(m => (
                          <td key={m.month} className={`py-2 px-4 text-right ${m.variance > 0 ? 'text-red-400' : m.variance < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                            {m.budget > 0 ? `${m.variance > 0 ? '+' : ''}${currency_symbol}${Math.abs(m.variance).toFixed(2)}` : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recurring transactions */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Recurring transactions</h2>
            <p className="text-xs text-gray-400 mb-4">Detected from last 13 months of transaction history</p>
            {recurringTx.length === 0 ? (
              <p className="text-sm text-gray-400">No recurring transactions detected yet — more data needed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left py-2 pr-4">Merchant</th>
                      <th className="text-left py-2 px-4">Category</th>
                      <th className="text-left py-2 px-4">Interval</th>
                      <th className="text-right py-2 px-4">Avg amount</th>
                      <th className="text-center py-2 px-4">Fixed?</th>
                      <th className="text-right py-2 px-4">Occurrences</th>
                      <th className="text-right py-2 px-4">Last seen</th>
                      <th className="text-right py-2 px-4">Next expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringTx.map((r, i) => {
                      const today = new Date();
                      const next = new Date(r.next_expected);
                      const daysUntil = Math.round((next - today) / (1000 * 60 * 60 * 24));
                      const overdue = daysUntil < 0;
                      const soon = daysUntil >= 0 && daysUntil <= 7;

                      return (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 pr-4 text-gray-700 font-medium">{r.merchant}</td>
                          <td className="py-2 px-4 text-gray-500">{r.category ?? '—'}</td>
                          <td className="py-2 px-4">
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              backgroundColor: r.interval === 'weekly' ? '#E6F1FB' : r.interval === 'monthly' ? '#EAF3DE' : '#EEEDFE',
                              color: r.interval === 'weekly' ? '#185FA5' : r.interval === 'monthly' ? '#27500A' : '#3C3489',
                              fontWeight: '500',
                            }}>
                              {r.interval}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-medium">{currency_symbol}{r.avg_amount.toFixed(2)}</td>
                          <td className="py-2 px-4 text-center">
                            {r.fixed_amount
                              ? <span style={{ color: '#15803d' }}>✓ Fixed</span>
                              : <span style={{ color: '#9ca3af' }}>~Variable</span>
                            }
                          </td>
                          <td className="py-2 px-4 text-right text-gray-500">{r.occurrences}×</td>
                          <td className="py-2 px-4 text-right text-gray-400">{r.last_date}</td>
                          <td className="py-2 px-4 text-right">
                            <span style={{
                              color: overdue ? '#b91c1c' : soon ? '#854F0B' : '#374151',
                              fontWeight: overdue || soon ? '500' : '400',
                            }}>
                              {r.next_expected}
                              {overdue && <span style={{ fontSize: '10px', marginLeft: '4px', color: '#b91c1c' }}>overdue</span>}
                              {soon && !overdue && <span style={{ fontSize: '10px', marginLeft: '4px', color: '#854F0B' }}>soon</span>}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </main>
  );
}