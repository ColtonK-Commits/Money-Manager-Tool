import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const categories = db.prepare(`
      SELECT * FROM categories
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(userId);

    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { name, colour } = await request.json();

    db.prepare(`
      INSERT OR IGNORE INTO categories (name, colour, user_id)
      VALUES (?, ?, ?)
    `).run(name, colour, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}