// app/transactions/page.js

'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePreferences } from '../context/preferences';

function TransactionsInner() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [editColour, setEditColour] = useState('#6b7280');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitRows, setSplitRows] = useState([
    { amount: '', category: '', memo: '' },
    { amount: '', category: '', memo: '' },
  ]);
  const [splitError, setSplitError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryColours, setCategoryColours] = useState({});
  const [sortCol, setSortCol] = useState('transaction_date');
  const [sortDir, setSortDir] = useState('desc');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const labelDropdownRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { currency_symbol } = usePreferences();

  // Filters
  const [filterCategory, setFilterCategory] = useState(
    searchParams.get('category') ? [searchParams.get('category')] : []
  );
  const [filterType, setFilterType] = useState([]);
  const [filterLabel, setFilterLabel] = useState([]);
  const [filterAccount, setFilterAccount] = useState([]);
  const [filterStart, setFilterStart] = useState(searchParams.get('start') ?? '');
  const [filterEnd, setFilterEnd] = useState(searchParams.get('end') ?? '');

  // Checkboxes
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [isolating, setIsolating] = useState(false);

  const [newForm, setNewForm] = useState({
    transaction_date: '', post_date: '', description: '', category: '',
    colour: '#6b7280', type: '', amount: '', memo: '', account: '',
  });

  useEffect(() => {
    function handleClickOutside(e) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) setCategoryDropdownOpen(false);
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) setTypeDropdownOpen(false);
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(e.target)) setLabelDropdownOpen(false);
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) setAccountDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
    fetchCategories();
    fetchLinkedAccounts();
  }, []);

  useEffect(() => {
    applyFiltersAndSort(transactions, filterCategory, filterType, filterLabel, filterAccount, filterStart, filterEnd, sortCol, sortDir, searchQuery, isolating, checkedIds);
  }, [transactions, filterCategory, filterType, filterLabel, filterAccount, filterStart, filterEnd, sortCol, sortDir, searchQuery, isolating, checkedIds]);

  function fetchTransactions() {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => setTransactions(data));
  }

  function fetchAccounts() {
    fetch('/api/transactions?accounts=true')
      .then(res => res.json())
      .then(data => setAccounts(data));
  }

  function fetchLinkedAccounts() {
    fetch('/api/plaid/accounts')
      .then(res => res.json())
      .then(data => setLinkedAccounts(Array.isArray(data) ? data : []));
  }

  function fetchCategories() {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        const colourMap = {};
        data.forEach(c => { colourMap[c.name] = c.colour; });
        setCategoryColours(colourMap);
      });
  }

  function getAccountLabel(accountId) {
    const linked = linkedAccounts.find(a => a.account_id === accountId);
    return linked ? `${linked.institution_name} — ${linked.account_name}` : accountId;
  }

  function getUniqueAccounts(data) {
    return [...new Set(data.map(t => t.account).filter(a => a && a.trim() !== ''))].sort();
  }

  function applyFiltersAndSort(data, category, type, label, account, start, end, col, dir, searchQuery, isolating, checkedIds) {
    let result = [...data];

    if (isolating) {
      result = result.filter(t => checkedIds.has(t.id));
    } else {
      if (category.length > 0) {
        result = result.filter(t => {
          if (category.includes('')) return !t.category || t.category === '';
          return category.includes(t.category);
        });
      }
      if (type.length > 0) result = result.filter(t => type.includes(t.type));
      if (label.length > 0) result = result.filter(t => label.includes(t.custom_label));
      if (account.length > 0) result = result.filter(t => account.includes(t.account));
      if (start) result = result.filter(t => t.transaction_date >= start);
      if (end) result = result.filter(t => t.transaction_date <= end);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(t =>
          (t.custom_description ?? t.description ?? '').toLowerCase().includes(q) ||
          (t.category ?? '').toLowerCase().includes(q) ||
          (t.memo ?? '').toLowerCase().includes(q)
        );
      }
    }

    result.sort((a, b) => {
      let aVal = a[col] ?? '';
      let bVal = b[col] ?? '';

      if (col === 'amount') {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
        return dir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (col === 'description') {
        aVal = (a.custom_description ?? a.description ?? '').toLowerCase();
        bVal = (b.custom_description ?? b.description ?? '').toLowerCase();
      }

      return dir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    setFiltered(result);
  }

  function handleSort(col) {
    if (col === sortCol) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function sortIndicator(col) {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function clearFilters() {
    setFilterCategory([]);
    setFilterType([]);
    setFilterLabel([]);
    setFilterAccount([]);
    setFilterStart('');
    setFilterEnd('');
    setSearchQuery('');
  }

  function toggleCheck(id, e) {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCheckAll() {
    const visibleIds = filtered.map(t => t.id);
    const allChecked = visibleIds.every(id => checkedIds.has(id));
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allChecked) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  }

  function clearChecks() {
    setCheckedIds(new Set());
    setIsolating(false);
  }

  // Get checked transaction objects
  const checkedTransactions = transactions.filter(t => checkedIds.has(t.id));
  const checkedTotal = checkedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const checkedByCategory = checkedTransactions.reduce((acc, t) => {
    const cat = t.category ?? 'Uncategorised';
    acc[cat] = (acc[cat] ?? 0) + Math.abs(t.amount);
    return acc;
  }, {});

  // Export checked to Excel
  async function handleExportCheckedExcel() {
    const XLSX = await import('xlsx');
    const wsData = [
      ['Date', 'Description', 'Category', 'Type', 'Label', 'Amount', 'Memo', 'Account'],
      ...checkedTransactions.map(t => [
        t.transaction_date,
        t.custom_description ?? t.description,
        t.category ?? '',
        t.type ?? '',
        t.custom_label ?? '',
        t.amount,
        t.memo ?? '',
        t.account ?? '',
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Selected Transactions');
    XLSX.writeFile(wb, `selected-transactions-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // Export checked to PDF
  async function handleExportCheckedPdf() {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55);
    doc.text('Selected Transactions', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`${checkedIds.size} transactions · Total: ${currency_symbol}${checkedTotal.toFixed(2)}`, pageWidth / 2, 28, { align: 'center' });

    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Description', 'Category', 'Amount']],
      body: checkedTransactions.map(t => [
        t.transaction_date,
        (t.custom_description ?? t.description ?? '').slice(0, 40),
        t.category ?? '',
        `${t.amount >= 0 ? '+' : '-'}${currency_symbol}${Math.abs(t.amount).toFixed(2)}`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    doc.save(`selected-transactions-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function handleCategoryChange(e) {
    const value = e.target.value;
    const existingColour = categoryColours[value];
    setNewForm({ ...newForm, category: value, colour: existingColour ?? '#6b7280' });
  }

  function handleRowClick(transaction) {
    setSelected(transaction);
    setSplitting(false);
    setSplitError('');
    setForm({
      custom_description: transaction.custom_description ?? '',
      custom_label: transaction.custom_label ?? '',
      category: transaction.category ?? '',
      type: transaction.type ?? '',
      memo: transaction.memo ?? '',
    });
    setEditColour(categoryColours[transaction.category] ?? '#6b7280');
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSplitCountChange(count) {
    setSplitCount(count);
    const rows = Array.from({ length: count }, (_, i) => splitRows[i] ?? { amount: '', category: '', memo: '' });
    setSplitRows(rows);
  }

  function updateSplitRow(index, field, value) {
    const updated = [...splitRows];
    updated[index] = { ...updated[index], [field]: value };
    setSplitRows(updated);
  }

  async function handleSplit() {
    setSplitError('');
    const originalAmount = Math.abs(selected.amount);
    const splitTotal = splitRows.slice(0, splitCount).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    if (Math.abs(splitTotal - originalAmount) > 0.01) {
      setSplitError(`Split amounts (${splitTotal.toFixed(2)}) must equal original (${originalAmount.toFixed(2)})`);
      return;
    }

    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        action: 'split',
        splits: splitRows.slice(0, splitCount),
      }),
    });

    fetchTransactions();
    setSelected(null);
    setSplitting(false);
  }

  async function handleUnsplit() {
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, action: 'unsplit' }),
    });
    fetchTransactions();
    setSelected(null);
  }

  async function handleAddTransaction() {
    const existingColour = categoryColours[newForm.category];
    if (!existingColour && newForm.category) {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newForm.category, colour: newForm.colour }),
      });
      await fetchCategories();
    }
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, amount: parseFloat(newForm.amount) }),
    });
    fetchTransactions();
    fetchAccounts();
    setAdding(false);
    setNewForm({ transaction_date: '', post_date: '', description: '', category: '', colour: '#6b7280', type: '', amount: '', memo: '', account: '' });
  }

  async function handleDelete() {
    await fetch(`/api/transactions?id=${selected.id}`, { method: 'DELETE' });
    fetchTransactions();
    setSelected(null);
    setConfirmDelete(false);
  }

  async function handleSave() {
    if (!categoryColours[form.category] && form.category) {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.category, colour: editColour }),
      });
      await fetchCategories();
    }
    const clean = v => (v === '' || v === undefined) ? null : v;
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        custom_description: clean(form.custom_description),
        custom_label: clean(form.custom_label),
        category: clean(form.category),
        type: clean(form.type),
        memo: clean(form.memo),
      }),
    });
    fetchTransactions();
    setSelected(null);
  }

  const isExistingCategory = !!categoryColours[newForm.category];
  const hasFilters = filterCategory.length > 0 || filterType.length > 0 || filterLabel.length > 0 || filterAccount.length > 0 || filterStart || filterEnd || searchQuery.trim();
  const uniqueTypes = [...new Set(transactions.map(t => t.type).filter(t => t && t.trim() !== ''))].sort();
  const uniqueLabels = [...new Set(transactions.map(t => t.custom_label).filter(t => t && t.trim() !== ''))].sort();
  const uniqueAccounts = getUniqueAccounts(transactions);

  const visibleIds = filtered.map(t => t.id);
  const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => checkedIds.has(id));

  const sumTotal = filtered
    .filter(t => !t.is_original_split)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">← Back to dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-800">Transactions</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/merchants" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium">
            Merchant Names
          </Link>
          <button onClick={() => setAdding(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium">
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Isolation banner */}
      {isolating && (
        <div style={{
          backgroundColor: '#185FA5', color: '#fff', padding: '10px 16px',
          borderRadius: '10px', marginBottom: '12px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', fontSize: '13px',
        }}>
          <span>Showing {checkedIds.size} selected transaction{checkedIds.size !== 1 ? 's' : ''}</span>
          <button onClick={() => setIsolating(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', padding: '3px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
            ✕ Exit isolation
          </button>
        </div>
      )}

      {/* Selection summary bar */}
      {checkedIds.size > 0 && (
        <div style={{
          backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
          padding: '12px 16px', marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                {checkedIds.size} selected · {currency_symbol}{checkedTotal.toFixed(2)}
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Object.entries(checkedByCategory).slice(0, 5).map(([cat, total]) => (
                  <span key={cat} style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                    backgroundColor: '#f3f4f6', color: '#374151',
                  }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: categoryColours[cat] ?? '#d1d5db', marginRight: '4px' }} />
                    {cat}: {currency_symbol}{total.toFixed(0)}
                  </span>
                ))}
                {Object.keys(checkedByCategory).length > 5 && (
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>+{Object.keys(checkedByCategory).length - 5} more</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setIsolating(true)}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '7px', backgroundColor: '#E6F1FB', color: '#185FA5', border: 'none', cursor: 'pointer', fontWeight: '500' }}
              >
                View selected
              </button>
              <button
                onClick={handleExportCheckedExcel}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '7px', backgroundColor: '#EAF3DE', color: '#27500A', border: 'none', cursor: 'pointer', fontWeight: '500' }}
              >
                ⬇ Excel
              </button>
              <button
                onClick={handleExportCheckedPdf}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '7px', backgroundColor: '#FCEBEB', color: '#791F1F', border: 'none', cursor: 'pointer', fontWeight: '500' }}
              >
                ⬇ PDF
              </button>
              <button
                onClick={clearChecks}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '7px', backgroundColor: '#f3f4f6', color: '#6b7280', border: 'none', cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {!isolating && (
        <div className="bg-white rounded-xl shadow px-4 py-3 mb-4 flex flex-wrap gap-3 items-end">

          {/* Category dropdown */}
          <div ref={categoryDropdownRef} style={{ position: 'relative' }}>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <button
              onClick={() => { setCategoryDropdownOpen(o => !o); setTypeDropdownOpen(false); setLabelDropdownOpen(false); setAccountDropdownOpen(false); }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white w-44 text-left flex justify-between items-center"
            >
              <span className="truncate text-gray-700">
                {filterCategory.length === 0 ? 'All categories' : filterCategory.length === 1 ? filterCategory[0] || 'Uncategorised' : `${filterCategory.length} selected`}
              </span>
              <span className="text-gray-400 ml-2">▾</span>
            </button>
            {categoryDropdownOpen && (
              <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-blue-600 font-medium border-b border-gray-100"
                  onClick={() => setFilterCategory(categories.map(c => c.name).filter(n => n !== 'Transfer'))}>
                  ✓ All except Transfers
                </div>
                <div className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-orange-500 font-medium border-b border-gray-100"
                  onClick={() => setFilterCategory([''])}>
                  ⚠ Uncategorised only
                </div>
                <div className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-400 border-b border-gray-100"
                  onClick={() => setFilterCategory([])}>
                  Clear selection
                </div>
                {categories.map(c => (
                  <label key={c.name} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={filterCategory.includes(c.name)}
                      onChange={() => setFilterCategory(prev =>
                        prev.includes(c.name) ? prev.filter(x => x !== c.name) : [...prev, c.name]
                      )} />
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryColours[c.name] ?? '#d1d5db' }} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Type dropdown */}
          <div ref={typeDropdownRef} style={{ position: 'relative' }}>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <button
              onClick={() => { setTypeDropdownOpen(o => !o); setCategoryDropdownOpen(false); setLabelDropdownOpen(false); setAccountDropdownOpen(false); }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white w-44 text-left flex justify-between items-center"
            >
              <span className="truncate text-gray-700">
                {filterType.length === 0 ? 'All types' : filterType.length === 1 ? filterType[0] : `${filterType.length} selected`}
              </span>
              <span className="text-gray-400 ml-2">▾</span>
            </button>
            {typeDropdownOpen && (
              <div className="absolute z-20 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {uniqueTypes.map(t => (
                  <label key={t} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={filterType.includes(t)}
                      onChange={() => setFilterType(prev =>
                        prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                      )} />
                    <span className="text-gray-700">{t}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Label dropdown */}
          <div ref={labelDropdownRef} style={{ position: 'relative' }}>
            <label className="block text-xs text-gray-500 mb-1">Label</label>
            <button
              onClick={() => { setLabelDropdownOpen(o => !o); setCategoryDropdownOpen(false); setTypeDropdownOpen(false); setAccountDropdownOpen(false); }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white w-44 text-left flex justify-between items-center"
            >
              <span className="truncate text-gray-700">
                {filterLabel.length === 0 ? 'All labels' : filterLabel.length === 1 ? filterLabel[0] : `${filterLabel.length} selected`}
              </span>
              <span className="text-gray-400 ml-2">▾</span>
            </button>
            {labelDropdownOpen && (
              <div className="absolute z-20 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {uniqueLabels.map(l => (
                  <label key={l} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={filterLabel.includes(l)}
                      onChange={() => setFilterLabel(prev =>
                        prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
                      )} />
                    <span className="text-gray-700">{l}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Account dropdown */}
          <div ref={accountDropdownRef} style={{ position: 'relative' }}>
            <label className="block text-xs text-gray-500 mb-1">Account</label>
            <button
              onClick={() => { setAccountDropdownOpen(o => !o); setCategoryDropdownOpen(false); setTypeDropdownOpen(false); setLabelDropdownOpen(false); }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white w-44 text-left flex justify-between items-center"
            >
              <span className="truncate text-gray-700">
                {filterAccount.length === 0 ? 'All accounts' : filterAccount.length === 1 ? getAccountLabel(filterAccount[0]) : `${filterAccount.length} selected`}
              </span>
              <span className="text-gray-400 ml-2">▾</span>
            </button>
            {accountDropdownOpen && (
              <div className="absolute z-20 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {uniqueAccounts.map(a => (
                  <label key={a} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={filterAccount.includes(a)}
                      onChange={() => setFilterAccount(prev =>
                        prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
                      )} />
                    <span className="truncate text-gray-700">{getAccountLabel(a)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search descriptions..."
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-44" />
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 underline pb-1.5">
              Clear filters
            </button>
          )}
          <div className="ml-auto text-xs text-gray-400 pb-1.5">
            {filtered.filter(t => !t.is_original_split).length} transaction{filtered.filter(t => !t.is_original_split).length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 w-8">
                <input type="checkbox" checked={allVisibleChecked} onChange={toggleCheckAll}
                  className="cursor-pointer" />
              </th>
              {[
                { label: 'Category', col: 'category' },
                { label: 'Date', col: 'transaction_date' },
                { label: 'Description', col: 'description' },
                { label: 'Amount', col: 'amount' },
              ].map(({ label, col }) => (
                <th key={col} onClick={() => handleSort(col)}
                  className={`px-4 py-3 cursor-pointer select-none hover:bg-gray-200 ${col === 'amount' ? 'text-right' : 'text-left'}`}>
                  {label}{sortIndicator(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const isOriginalSplit = t.is_original_split === 1;
              const isSplitChild = !!t.split_group_id && t.is_original_split === 0;
              const isChecked = checkedIds.has(t.id);

              return (
                <tr
                  key={t.id}
                  onClick={() => handleRowClick(t)}
                  className={`border-t border-gray-100 cursor-pointer ${isOriginalSplit ? 'bg-gray-50 opacity-50' : isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-4 py-3" onClick={e => toggleCheck(t.id, e)}>
                    <input type="checkbox" checked={isChecked} onChange={() => {}}
                      className="cursor-pointer" />
                  </td>
                  <td className="px-4 py-3">
                    {isSplitChild && <span style={{ marginRight: '6px', color: '#d1d5db' }}>↳</span>}
                    <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: categoryColours[t.category] ?? '#d1d5db' }} />
                    {t.category ?? 'Uncategorised'}
                    {isOriginalSplit && (
                      <span style={{ fontSize: '10px', marginLeft: '6px', padding: '1px 6px', borderRadius: '20px', backgroundColor: '#e5e7eb', color: '#6b7280' }}>split</span>
                    )}
                    {t.category === 'Transfer' && !isOriginalSplit && (
                      <span style={{ fontSize: '10px', marginLeft: '6px', padding: '1px 6px', borderRadius: '20px', backgroundColor: '#f3f4f6', color: '#9ca3af' }}>transfer</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.transaction_date}</td>
                  <td className="px-4 py-3">{t.custom_description ?? t.description}</td>
                  <td className={`px-4 py-3 text-right font-medium ${t.amount > 0 ? 'text-green-600' : 'text-gray-800'}`}>
                    {t.amount > 0 ? '+' : '-'}{currency_symbol}{Math.abs(t.amount).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Sum row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px', borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb', borderRadius: '0 0 12px 12px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
            Total ({filtered.filter(t => !t.is_original_split).length} transaction{filtered.filter(t => !t.is_original_split).length !== 1 ? 's' : ''})
          </span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#111' }}>
            {currency_symbol}{sumTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Add Transaction modal */}
      {adding && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Add Transaction</h2>
            <div className="space-y-3">
              {[
                { label: 'Transaction Date', name: 'transaction_date', type: 'date' },
                { label: 'Post Date', name: 'post_date', type: 'date' },
                { label: 'Description', name: 'description', type: 'text' },
                { label: 'Type', name: 'type', type: 'text' },
                { label: 'Amount', name: 'amount', type: 'number' },
                { label: 'Memo', name: 'memo', type: 'text' },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                  <input name={field.name} type={field.type} value={newForm[field.name]}
                    onChange={e => setNewForm({ ...newForm, [e.target.name]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <input name="category" list="category-options" value={newForm.category}
                  onChange={handleCategoryChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Select or type a category" />
                <datalist id="category-options">
                  {categories.map(c => <option key={c.name} value={c.name} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Category Colour
                  {isExistingCategory && <span className="ml-2 text-gray-400 font-normal">(already assigned)</span>}
                </label>
                <div className="flex items-center gap-3">
                  <input type="color" value={newForm.colour}
                    onChange={e => setNewForm({ ...newForm, colour: e.target.value })}
                    disabled={isExistingCategory}
                    className="w-10 h-10 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" />
                  <span className="text-sm text-gray-500">
                    {isExistingCategory ? 'Colour locked to existing category' : 'Pick a colour for this new category'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
                <input name="account" list="account-options" value={newForm.account}
                  onChange={e => setNewForm({ ...newForm, account: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Select or type an account" />
                <datalist id="account-options">
                  {accounts.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleAddTransaction} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Save</button>
              <button onClick={() => setAdding(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Transaction Details</h2>
            <div className="text-sm text-gray-500 mb-4">
              <p><span className="font-medium">Original description:</span> {selected.description}</p>
              <p><span className="font-medium">Transaction date:</span> {selected.transaction_date}</p>
              <p><span className="font-medium">Amount:</span> {currency_symbol}{Math.abs(selected.amount).toFixed(2)}</p>
            </div>

            {splitting ? (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Split into how many?</p>
                <div className="flex gap-2 mb-4">
                  {[2, 3].map(n => (
                    <button key={n} onClick={() => handleSplitCountChange(n)}
                      style={{
                        padding: '4px 16px', borderRadius: '8px', fontSize: '14px',
                        backgroundColor: splitCount === n ? '#185FA5' : '#f3f4f6',
                        color: splitCount === n ? '#fff' : '#374151',
                        border: 'none', cursor: 'pointer',
                      }}
                    >{n}</button>
                  ))}
                </div>
                <div className="space-y-3 mb-3">
                  {Array.from({ length: splitCount }).map((_, i) => (
                    <div key={i} style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '0.5px solid #e5e7eb' }}>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '500' }}>Split {i + 1}</p>
                      <div className="flex gap-2 mb-2">
                        <div style={{ flex: 1 }}>
                          <label className="block text-xs text-gray-500 mb-1">Amount ({currency_symbol})</label>
                          <input type="number" min="0" step="0.01"
                            value={splitRows[i]?.amount ?? ''}
                            onChange={e => updateSplitRow(i, 'amount', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="block text-xs text-gray-500 mb-1">Category</label>
                          <input list={`split-cat-${i}`}
                            value={splitRows[i]?.category ?? ''}
                            onChange={e => updateSplitRow(i, 'category', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Category" />
                          <datalist id={`split-cat-${i}`}>
                            {categories.map(c => <option key={c.name} value={c.name} />)}
                          </datalist>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Memo (optional)</label>
                        <input type="text"
                          value={splitRows[i]?.memo ?? ''}
                          onChange={e => updateSplitRow(i, 'memo', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="Note for this portion" />
                      </div>
                    </div>
                  ))}
                </div>
                {splitError && <p style={{ fontSize: '12px', color: '#b91c1c', marginBottom: '8px' }}>{splitError}</p>}
                {(() => {
                  const entered = splitRows.slice(0, splitCount).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                  const remaining = Math.abs(selected.amount) - entered;
                  return (
                    <div style={{ fontSize: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>Entered: {currency_symbol}{entered.toFixed(2)} / {currency_symbol}{Math.abs(selected.amount).toFixed(2)}</span>
                      <span style={{ fontWeight: '500', color: remaining < 0 ? '#b91c1c' : remaining === 0 ? '#15803d' : '#854F0B' }}>
                        Remaining: {currency_symbol}{remaining.toFixed(2)}
                      </span>
                    </div>
                  );
                })()}
                <div className="flex gap-3">
                  <button onClick={handleSplit} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Confirm split</button>
                  <button onClick={() => setSplitting(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Custom Description', name: 'custom_description' },
                  { label: 'Custom Label', name: 'custom_label' },
                  { label: 'Type', name: 'type' },
                  { label: 'Memo', name: 'memo' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                    <input name={field.name} value={form[field.name]} onChange={handleFormChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <input name="category" list="edit-category-options" value={form.category}
                    onChange={e => { setForm({ ...form, category: e.target.value }); setEditColour(categoryColours[e.target.value] ?? '#6b7280'); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Select or type a category" />
                  <datalist id="edit-category-options">
                    {categories.map(c => <option key={c.name} value={c.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Category Colour
                    {!!categoryColours[form.category] && <span className="ml-2 text-gray-400 font-normal">(already assigned)</span>}
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={editColour}
                      onChange={e => setEditColour(e.target.value)}
                      disabled={!!categoryColours[form.category]}
                      className="w-10 h-10 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" />
                    <span className="text-sm text-gray-500">
                      {!!categoryColours[form.category] ? 'Colour locked to existing category' : 'Pick a colour for this new category'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!splitting && (
              <>
                {confirmDelete ? (
                  <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700 font-medium mb-3">Are you sure you want to delete this transaction? This cannot be undone.</p>
                    <div className="flex gap-3">
                      <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Yes, delete it</button>
                      <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-2">
                    <div className="flex gap-3">
                      <button onClick={handleSave} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Save</button>
                      <button onClick={() => setConfirmDelete(true)} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg py-2 text-sm font-medium">Delete</button>
                      <button onClick={() => setSelected(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium">Cancel</button>
                    </div>
                    <div className="flex gap-3">
                      {!selected.is_original_split && !selected.split_group_id && (
                        <button
                          onClick={() => { setSplitting(true); setSplitRows(Array.from({ length: splitCount }, () => ({ amount: '', category: '', memo: '' }))); }}
                          className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg py-2 text-sm font-medium"
                        >
                          ✂ Split transaction
                        </button>
                      )}
                      {selected.is_original_split === 1 && (
                        <button onClick={handleUnsplit} className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg py-2 text-sm font-medium">
                          ↩ Unsplit
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading...</div>}>
      <TransactionsInner />
    </Suspense>
  );
}