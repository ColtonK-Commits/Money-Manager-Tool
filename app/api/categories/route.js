import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { NextResponse } from 'next/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(process.cwd(), 'money_manager.db'));

export async function GET() {
  try {
    const categories = db.prepare(`
      SELECT * FROM categories
      ORDER BY name ASC
    `).all();

    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, colour } = await request.json();

    db.prepare(`
      INSERT OR IGNORE INTO categories (name, colour)
      VALUES (?, ?)
    `).run(name, colour);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}