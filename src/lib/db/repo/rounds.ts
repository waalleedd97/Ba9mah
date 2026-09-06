import { getDb, now } from '../index';
import type { Round, RoundStatus } from '@/lib/types';

interface RoundRow {
  id: number;
  topic: string | null;
  exploratory: number;
  status: RoundStatus;
  model: string | null;
  input_tokens: number | null;
  cached_tokens: number | null;
  output_tokens: number | null;
  created_at: number;
  completed_at: number | null;
}

function rowToRound(r: RoundRow): Round {
  return {
    id: r.id,
    topic: r.topic,
    exploratory: r.exploratory,
    status: r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

export function createRound(input: {
  topic: string | null;
  exploratory: number;
  model: string;
  usage?: { input: number; cached: number; output: number };
}): Round {
  const res = getDb()
    .prepare(
      `INSERT INTO rounds (topic, exploratory, status, model, input_tokens, cached_tokens, output_tokens, created_at)
       VALUES (?, ?, 'rating', ?, ?, ?, ?, ?)`,
    )
    .run(
      input.topic,
      input.exploratory,
      input.model,
      input.usage?.input ?? null,
      input.usage?.cached ?? null,
      input.usage?.output ?? null,
      now(),
    );
  return getRound(Number(res.lastInsertRowid))!;
}

export function getRound(id: number): Round | null {
  const row = getDb().prepare('SELECT * FROM rounds WHERE id = ?').get(id) as RoundRow | undefined;
  return row ? rowToRound(row) : null;
}

export function latestRound(): Round | null {
  const row = getDb().prepare('SELECT * FROM rounds ORDER BY id DESC LIMIT 1').get() as RoundRow | undefined;
  return row ? rowToRound(row) : null;
}

export function countRounds(): number {
  return (getDb().prepare('SELECT COUNT(*) AS c FROM rounds').get() as { c: number }).c;
}

export function completeRound(id: number) {
  getDb().prepare(`UPDATE rounds SET status = 'done', completed_at = ? WHERE id = ? AND status <> 'done'`).run(now(), id);
}

export function roundIsFullyRated(id: number): boolean {
  const r = getDb()
    .prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN rating IS NULL THEN 1 ELSE 0 END) AS unrated FROM posts WHERE round_id = ?')
    .get(id) as { total: number; unrated: number | null };
  return r.total > 0 && (r.unrated ?? 0) === 0;
}
