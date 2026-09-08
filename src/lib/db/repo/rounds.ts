import { getDb, now } from '../index';
import type { NewsBrief, Round, RoundStatus } from '@/lib/types';

interface RoundRow {
  id: number;
  topic: string | null;
  exploratory: number;
  status: RoundStatus;
  model: string | null;
  input_tokens: number | null;
  cached_tokens: number | null;
  output_tokens: number | null;
  news_json: string | null;
  created_at: number;
  completed_at: number | null;
}

function parseNews(json: string | null): NewsBrief | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as NewsBrief;
  } catch {
    return null;
  }
}

function rowToRound(r: RoundRow): Round {
  return {
    id: r.id,
    topic: r.topic,
    exploratory: r.exploratory,
    status: r.status,
    news: parseNews(r.news_json),
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

export function createRound(input: {
  topic: string | null;
  exploratory: number;
  model: string;
  usage?: { input: number; cached: number; output: number };
  news?: NewsBrief | null;
}): Round {
  const res = getDb()
    .prepare(
      `INSERT INTO rounds (topic, exploratory, status, model, input_tokens, cached_tokens, output_tokens, news_json, created_at)
       VALUES (?, ?, 'rating', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.topic,
      input.exploratory,
      input.model,
      input.usage?.input ?? null,
      input.usage?.cached ?? null,
      input.usage?.output ?? null,
      input.news ? JSON.stringify(input.news) : null,
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

export interface RoundSummary extends Round {
  liked: number;
  disliked: number;
  total: number;
}

export function listRoundSummaries(limit = 6): RoundSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT r.*,
              COALESCE(SUM(CASE WHEN p.rating = 'liked' THEN 1 ELSE 0 END), 0) AS liked,
              COALESCE(SUM(CASE WHEN p.rating = 'disliked' THEN 1 ELSE 0 END), 0) AS disliked,
              COUNT(p.id) AS total
       FROM rounds r LEFT JOIN posts p ON p.round_id = r.id
       GROUP BY r.id
       HAVING COUNT(p.id) > 0
       ORDER BY r.id DESC LIMIT ?`,
    )
    .all(limit) as Array<RoundRow & { liked: number; disliked: number; total: number }>;
  return rows.map((r) => ({ ...rowToRound(r), liked: r.liked, disliked: r.disliked, total: r.total }));
}
