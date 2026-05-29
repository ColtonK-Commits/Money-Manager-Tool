'use client';
// app/page.js

import Link from 'next/link';

const tiles = [
  {
    href: '/transactions',
    name: 'Transactions',
    description: 'View, import and label your bank transactions',
    icon: '📋',
    color: '#E1F5EE',
    borderColor: '#9FE1CB',
    iconColor: '#0F6E56',
    badgeBg: '#9FE1CB',
    badgeText: '#085041',
    badge: 'Active',
    active: true,
  },
  {
    href: '/budgets',
    name: 'Budget',
    description: 'Set monthly targets per category',
    icon: '🎯',
    color: '#E6F1FB',
    borderColor: '#B5D4F4',
    iconColor: '#185FA5',
    badgeBg: '#B5D4F4',
    badgeText: '#0C447C',
    badge: 'Active',
    active: true,
  },
  {
    href: '/spending',
    name: 'Spending Tracker',
    description: 'See real spending by category over any date range',
    icon: '📅',
    color: '#FAEEDA',
    borderColor: '#FAC775',
    iconColor: '#854F0B',
    badgeBg: '#FAC775',
    badgeText: '#633806',
    badge: 'Active',
    active: true,
  },
  {
href: '/dashboard',
    name: 'Comparisons',
    description: 'Budget vs Actual Spending Charts and summaries',
    icon: '📊',
    color: '#EEEDFE',
    borderColor: '#CECBF6',
    iconColor: '#534AB7',
    badgeBg: '#CECBF6',
    badgeText: '#3C3489',
    badge: 'Active',
    active: true,
  },
  {
href: '/accounts',
    name: 'Linked Accounts',
    description: 'Connect and manage your bank accounts via Plaid',
    icon: '🏦',
    color: '#FAECE7',
    borderColor: '#F5C4B3',
    iconColor: '#993C1D',
    badgeBg: '#F5C4B3',
    badgeText: '#712B13',
    badge: 'Active',
    active: true,
  },
  {
href: '/reports',
    name: 'Reports',
    description: 'Monthly and yearly financial reports',
    icon: '📈',
    color: '#FBEAF0',
    borderColor: '#F4C0D1',
    iconColor: '#993556',
    badgeBg: '#F4C0D1',
    badgeText: '#72243E',
    badge: 'Active',
    active: true,
  },
  {
href: '/savings',
    name: 'Income & Savings',
    description: 'Track income and savings targets progress',
    icon: '🐷',
    color: '#EAF3DE',
    borderColor: '#C0DD97',
    iconColor: '#3B6D11',
    badgeBg: '#C0DD97',
    badgeText: '#27500A',
    badge: 'Active',
    active: true,
  },
  {
href: '/settings',
    name: 'Settings',
    description: 'Manage categories, merchants and preferences',
    icon: '⚙️',
    color: '#F1EFE8',
    borderColor: '#D3D1C7',
    iconColor: '#5F5E5A',
    badgeBg: '#D3D1C7',
    badgeText: '#444441',
    badge: 'Active',
    active: true,
  },
];

export default function HomePage() {
  return (
    <main style={{ padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif', maxWidth: '900px', margin: '0 auto' }}>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', margin: '0 0 4px' }}>Money Manager</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Your personal finance dashboard</p>
      </div>

      <div style={{
        display: 'grid',
gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px',
      }}>
        {tiles.map((tile) => {
          const inner = (
            <div
              style={{
                backgroundColor: tile.color,
                border: `0.5px solid ${tile.borderColor}`,
                borderRadius: '12px',
                padding: '1.25rem',
                minHeight: '150px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: tile.active ? 1 : 0.6,
                cursor: tile.active ? 'pointer' : 'default',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => { if (tile.active) e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div>
                <div style={{ fontSize: '22px', marginBottom: '0.75rem' }}>{tile.icon}</div>
                <p style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 4px', color: '#111' }}>{tile.name}</p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>{tile.description}</p>
              </div>
              <span style={{
                display: 'inline-block',
                marginTop: '10px',
                fontSize: '10px',
                fontWeight: '500',
                padding: '3px 8px',
                borderRadius: '20px',
                backgroundColor: tile.badgeBg,
                color: tile.badgeText,
                alignSelf: 'flex-start',
              }}>
                {tile.badge}
              </span>
            </div>
          );

          // Active tiles are wrapped in a Link, inactive ones are just the div
          return tile.active ? (
            <Link key={tile.name} href={tile.href} style={{ textDecoration: 'none' }}>
              {inner}
            </Link>
          ) : (
            <div key={tile.name}>{inner}</div>
          );
        })}
      </div>
    </main>
  );
}