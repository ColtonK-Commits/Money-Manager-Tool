// app/api/savings/route.js

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import sql from '../../../lib/db';

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('archived') === 'true';

    const goals = await sql`
      SELECT * FROM savings_goals
      WHERE user_id = ${userId}
        AND archived = ${includeArchived ? 1 : 0}
      ORDER BY target_date ASC
    `;

    const result = await Promise.all(goals.map(async goal => {
      const contributions = await sql`
        SELECT * FROM goal_contributions
        WHERE goal_id = ${goal.id}
        ORDER BY contribution_date DESC
      `;

      const total_saved = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
      const target_amount = parseFloat(goal.target_amount);
      const remaining = Math.max(0, target_amount - total_saved);
      const progress_pct = Math.min((total_saved / target_amount) * 100, 100);

      const today = new Date();
      const targetDate = new Date(goal.target_date);
      const createdAt = new Date(goal.created_at);
      const totalDays = Math.max(1, Math.round((targetDate - createdAt) / (1000 * 60 * 60 * 24)));
      const daysElapsed = Math.max(1, Math.round((today - createdAt) / (1000 * 60 * 60 * 24)));
      const daysRemaining = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24)));
      const expectedByNow = (target_amount / totalDays) * daysElapsed;
      const on_pace = total_saved >= expectedByNow;
      const daily_needed = daysRemaining > 0 ? Math.round((remaining / daysRemaining) * 100) / 100 : 0;

      return {
        ...goal,
        target_amount,
        contributions,
        total_saved: Math.round(total_saved * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        progress_pct: Math.round(progress_pct * 10) / 10,
        on_pace,
        days_remaining: daysRemaining,
        daily_needed,
        completed: total_saved >= target_amount,
      };
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/savings error:', error);
    return NextResponse.json({ error: 'Failed to fetch savings goals' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    // Create a new goal
    if (action === 'create_goal') {
      const { name, target_amount, target_date } = body;
      if (!name || !target_amount || !target_date) {
        return NextResponse.json({ error: 'name, target_amount and target_date are required' }, { status: 400 });
      }
      const result = await sql`
        INSERT INTO savings_goals (name, target_amount, target_date, user_id)
        VALUES (${name}, ${target_amount}, ${target_date}, ${userId})
        RETURNING id
      `;
      return NextResponse.json({ success: true, id: result[0].id });
    }

    // Log a contribution
    if (action === 'add_contribution') {
      const { goal_id, amount, note, contribution_date } = body;
      if (!goal_id || !amount || !contribution_date) {
        return NextResponse.json({ error: 'goal_id, amount and contribution_date are required' }, { status: 400 });
      }
      const goal = await sql`SELECT id FROM savings_goals WHERE id = ${goal_id} AND user_id = ${userId}`;
      if (goal.length === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

      await sql`
        INSERT INTO goal_contributions (goal_id, amount, note, contribution_date)
        VALUES (${goal_id}, ${amount}, ${note ?? null}, ${contribution_date})
      `;
      return NextResponse.json({ success: true });
    }

    // Archive a goal
    if (action === 'archive_goal') {
      const { goal_id } = body;
      const goal = await sql`SELECT id FROM savings_goals WHERE id = ${goal_id} AND user_id = ${userId}`;
      if (goal.length === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

      await sql`UPDATE savings_goals SET archived = 1 WHERE id = ${goal_id} AND user_id = ${userId}`;
      return NextResponse.json({ success: true });
    }

    // Unarchive a goal
    if (action === 'unarchive_goal') {
      const { goal_id } = body;
      const goal = await sql`SELECT id FROM savings_goals WHERE id = ${goal_id} AND user_id = ${userId}`;
      if (goal.length === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

      await sql`UPDATE savings_goals SET archived = 0 WHERE id = ${goal_id} AND user_id = ${userId}`;
      return NextResponse.json({ success: true });
    }

    // Delete a goal permanently
    if (action === 'delete_goal') {
      const { goal_id } = body;
      const goal = await sql`SELECT id FROM savings_goals WHERE id = ${goal_id} AND user_id = ${userId}`;
      if (goal.length === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

      await sql`DELETE FROM goal_contributions WHERE goal_id = ${goal_id}`;
      await sql`DELETE FROM savings_goals WHERE id = ${goal_id} AND user_id = ${userId}`;
      return NextResponse.json({ success: true });
    }

    // Delete a contribution
    if (action === 'delete_contribution') {
      const { contribution_id, goal_id } = body;
      const goal = await sql`SELECT id FROM savings_goals WHERE id = ${goal_id} AND user_id = ${userId}`;
      if (goal.length === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

      await sql`DELETE FROM goal_contributions WHERE id = ${contribution_id}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/savings error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}