import { getDb, now } from '../index';
import type { StyleProfile, StyleProfileData } from '@/lib/types';

interface ProfileRow {
  id: number;
  version: number;
  markdown: string;
  data_json: string;
  liked_count: number;
  disliked_count: number;
  created_at: number;
}

function rowToProfile(r: ProfileRow): StyleProfile {
  return {
    id: r.id,
    version: r.version,
    markdown: r.markdown,
    data: JSON.parse(r.data_json) as StyleProfileData,
    likedCount: r.liked_count,
    dislikedCount: r.disliked_count,
    createdAt: r.created_at,
  };
}

export function latestProfile(): StyleProfile | null {
  const row = getDb().prepare('SELECT * FROM style_profiles ORDER BY version DESC LIMIT 1').get() as ProfileRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function listProfiles(limit = 10): StyleProfile[] {
  const rows = getDb().prepare('SELECT * FROM style_profiles ORDER BY version DESC LIMIT ?').all(limit) as ProfileRow[];
  return rows.map(rowToProfile);
}

export function insertProfile(input: {
  markdown: string;
  data: StyleProfileData;
  likedCount: number;
  dislikedCount: number;
}): StyleProfile {
  const prev = latestProfile();
  const version = (prev?.version ?? 0) + 1;
  const res = getDb()
    .prepare(
      `INSERT INTO style_profiles (version, markdown, data_json, liked_count, disliked_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(version, input.markdown, JSON.stringify(input.data), input.likedCount, input.dislikedCount, now());
  const row = getDb().prepare('SELECT * FROM style_profiles WHERE id = ?').get(Number(res.lastInsertRowid)) as ProfileRow;
  return rowToProfile(row);
}
