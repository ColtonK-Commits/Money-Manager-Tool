// app/api/savings/route.js

import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('archived') === 'true';

    const goals = db.prepare(`
      SELECT * FROM savings_goals
      WHERE archived = ?
      ORDER BY target_date ASC
    `).all(includeArchived ? 1 : 0);

    // For each goal, get total saved and contributions
    const result = goals.map(goal => {
      const contributions = db.prepare(`
        SELECT * FROM goal_contributions
        WHERE goal_id = ?
        ORDER BY contribution_date DESC
      `).all(goal.id);

      const total_saved = contributions.reduce((sum, c) => sum + c.amount, 0);
      const remaining = Math.max(0, goal.target_amount - total_saved);
      const progress_pct = Math.min((total_saved / goal.target_amount) * 100, 100);

      // Calculate if on pace
      const today = new Date();
      const targetDate = new Date(goal.target_date);
      const createdAt = new Date(goal.created_at);
      const totalDays = Math.max(1, Math.round((targetDate - createdAt) / (1000 * 60 * 60 * 24)));
      const daysElapsed = Math.max(1, Math.round((today - createdAt) / (1000 * 60 * 60 * 24)));
      const daysRemaining = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24)));
      const expectedByNow = (goal.target_amount / totalDays) * daysElapsed;
      const on_pace = total_saved >= expectedByNow;
      const daily_needed = daysRemaining > 0 ? Math.round((remaining / daysRemaining) * 100) / 100 : 0;

      return {
        ...goal,
        contributions,
        total_saved: Math.round(total_saved * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        progress_pct: Math.round(progress_pct * 10) / 10,
        on_pace,
        days_remaining: daysRemaining,
        daily_needed,
        completed: total_saved >= goal.target_amount,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/savings error:', error);
    return NextResponse.json({ error: 'Failed to fetch savings goals' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Create a new goal
    if (action === 'create_goal') {
      const { name, target_amount, target_date } = body;
      if (!name || !target_amount || !target_date) {
        return NextResponse.json({ error: 'name, target_amount and target_date are required' }, { status: 400 });
      }
      const result = db.prepare(`
        INSERT INTO savings_goals (name, target_amount, target_date)
        VALUES (?, ?, ?)
      `).run(name, target_amount, target_date);
      return NextResponse.json({ success: true, id: result.lastInsertRowid });
    }

    // Log a contribution
    if (action === 'add_contribution') {
      const { goal_id, amount, note, contribution_date } = body;
      if (!goal_id || !amount || !contribution_date) {
        return NextResponse.json({ error: 'goal_id, amount and contribution_date are required' }, { status: 400 });
      }
      db.prepare(`
        INSERT INTO goal_contributions (goal_id, amount, note, contribution_date)
        VALUES (?, ?, ?, ?)
      `).run(goal_id, amount, note ?? null, contribution_date);
      return NextResponse.json({ success: true });
    }

    // Archive a goal
    if (action === 'archive_goal') {
      const { goal_id } = body;
      db.prepare(`UPDATE savings_goals SET archived = 1 WHERE id = ?`).run(goal_id);
      return NextResponse.json({ success: true });
    }

    // Unarchive a goal
    if (action === 'unarchive_goal') {
      const { goal_id } = body;
      db.prepare(`UPDATE savings_goals SET archived = 0 WHERE id = ?`).run(goal_id);
      return NextResponse.json({ success: true });
    }

    // Delete a goal permanently
    if (action === 'delete_goal') {
      const { goal_id } = body;
      db.prepare(`DELETE FROM goal_contributions WHERE goal_id = ?`).run(goal_id);
      db.prepare(`DELETE FROM savings_goals WHERE id = ?`).run(goal_id);
      return NextResponse.json({ success: true });
    }

    // Delete a contribution
    if (action === 'delete_contribution') {
      const { contribution_id } = body;
      db.prepare(`DELETE FROM goal_contributions WHERE id = ?`).run(contribution_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/savings error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}