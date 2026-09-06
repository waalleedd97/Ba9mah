import { getDb, now } from '../index';
import { newId } from '@/lib/ids';
import { getImage } from './images';
import type { SavedPost } from '@/lib/types';

interface SavedRow {
  id: string;
  post_id: string | null;
  content: string;
  topic: string;
  image_id: string | null;
  created_at: number;
  updated_at: number;
}

function rowToSaved(r: SavedRow): SavedPost {
  return {
    id: r.id,
    postId: r.post_id,
    content: r.content,
    topic: r.topic,
    imageId: r.image_id,
    image: r.image_id ? getImage(r.image_id) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listSaved(): SavedPost[] {
  const rows = getDb().prepare('SELECT * FROM saved_posts ORDER BY created_at DESC').all() as SavedRow[];
  return rows.map(rowToSaved);
}

export function getSaved(id: string): SavedPost | null {
  const row = getDb().prepare('SELECT * FROM saved_posts WHERE id = ?').get(id) as SavedRow | undefined;
  return row ? rowToSaved(row) : null;
}

export function findSavedByPost(postId: string): SavedPost | null {
  const row = getDb().prepare('SELECT * FROM saved_posts WHERE post_id = ?').get(postId) as SavedRow | undefined;
  return row ? rowToSaved(row) : null;
}

export function countSaved(): number {
  return (getDb().prepare('SELECT COUNT(*) AS c FROM saved_posts').get() as { c: number }).c;
}

export function insertSaved(input: {
  id?: string;
  postId?: string | null;
  content: string;
  topic: string;
  imageId?: string | null;
  createdAt?: number;
}): SavedPost {
  const id = input.id ?? newId('saved');
  const ts = input.createdAt ?? now();
  getDb()
    .prepare(
      `INSERT INTO saved_posts (id, post_id, content, topic, image_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.postId ?? null, input.content, input.topic, input.imageId ?? null, ts, ts);
  return getSaved(id)!;
}

export function updateSaved(id: string, patch: { content?: string; topic?: string; imageId?: string | null }): SavedPost | null {
  const cur = getSaved(id);
  if (!cur) return null;
  getDb()
    .prepare('UPDATE saved_posts SET content = ?, topic = ?, image_id = ?, updated_at = ? WHERE id = ?')
    .run(
      patch.content ?? cur.content,
      patch.topic ?? cur.topic,
      patch.imageId === undefined ? cur.imageId : patch.imageId,
      now(),
      id,
    );
  return getSaved(id);
}

export function deleteSaved(id: string) {
  getDb().prepare('DELETE FROM saved_posts WHERE id = ?').run(id);
}
