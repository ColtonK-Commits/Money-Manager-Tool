# Money Manager Tool — Project Summary

## Overview
A personal finance dashboard built with Next.js and SQLite. Allows importing of bank/credit card transactions, manual entry, merchant name normalisation, budget tracking, and a live spending dashboard. Built as a coding learning exercise following on from the French Quiz project.

## Status
🚧 In progress

## Tech Stack
- **Front end:** React (via Next.js App Router)
- **Back end:** Next.js API routes
- **Database:** SQLite via better-sqlite3
- **Package manager:** pnpm
- **Hosting:** localhost (Vercel deployment planned for Phase 6)
- **Testing:** Vitest (to be configured)

## Project Structure

## Database Tables
- **transactions** — id, transaction_date, post_date, description, custom_description, custom_label, category, type, amount, memo, account, plaid_transaction_id, split_group_id, is_original_split
- **monthly_budgets** — id, category, month (YYYY-MM), monthly_target. UNIQUE(category, month).
- **budgets** — baseline reference only
- **categories** — id, name, colour. Includes: Accommodation, Bills & Utilities, Clothes, Commute, Entertainment, Fees & Adjustments, Food & Drink, Gas, Gifts, Groceries, Shopping, Home, Personal, Professional Services, Transportation, Travel, Income, Transfer, Withdrawal
- **linked_accounts** — id, institution_name, account_name, account_type, account_subtype, account_id, access_token, cursor, last_synced, created_at
- **savings_goals** — id, name, target_amount, target_date, archived, created_at
- **goal_contributions** — id, goal_id, amount, note, contribution_date, created_at
- **preferences** — key, value (currency_symbol, default_date_range)

## Data Sources
- **BOA Checking** — 199 manual CSV import (Nov 2024–Feb 2026) + 16 Plaid live sync
- **Chase Credit Card** — 1990 manual CSV import (Jul 2024–Feb 2026) + Plaid live sync connected
- **Total transactions:** ~2205

## Phases
- ✅ Phase 1 — Project skeleton (Next.js, SQLite, folder structure, Vitest, bat shortcut)
- ✅ Phase 2 — Import Excel transaction data into database
- ✅ Phase 3 — Transactions view, manual entry, relabelling, split transactions
- ✅ Phase 4 — Budget tool with monthly targets, suggestions, income summary
- ✅ Phase 5 — Dashboard (charts, summaries, category trends, comparisons)
- ✅ Phase 6 — Plaid integration (production), BOA + Chase connected, historical imports
- ⬜ Phase 7 — Multi-user support (NextAuth.js + Postgres migration)

## Key Commands

## Key Features
- Transaction import via Plaid (live sync) and CSV (manual)
- Auto-categorisation for both Plaid and CSV imports
- Split transactions (2 or 3 ways) with restore on delete
- Transfer + Withdrawal categories excluded from all budget/spending calculations
- Currency symbol preference (display only)
- Default date range preference
- Recurring transaction detection (weekly/monthly/annual)
- Income tracker with bar chart and source table
- Savings goals with progress tracking
- Budget vs actual with end-of-month projections
- Category trends table (last 12 months)
- Excel and PDF export

## Known Limitations
- SQLite is local only — data lives on this machine
- Plaid trial tier — 10 connected items max
- Multi-user support planned for Phase 7

## User Profile
- Non-technical background, learning to code
- Windows machine (Lenovo T420s)
- Uses Command Prompt (not PowerShell)
- DB Browser for SQLite installed for visual database management