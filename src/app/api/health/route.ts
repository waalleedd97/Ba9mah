import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getDb().prepare('SELECT 1').get();
    return NextResponse.json({ ok: true, version: process.env.npm_package_version ?? '2.0.0', time: Date.now() });
  } catch (err) {
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : 'db error' }, { status: 500 });
  }
}
