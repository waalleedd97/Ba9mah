import { getDb, now } from '../index';
import { newId } from '@/lib/ids';
import type { ImageRecord, ImageSource, Rating, StyleStat } from '@/lib/types';

interface ImageRow {
  id: string;
  post_id: string | null;
  saved_post_id: string | null;
  source: ImageSource;
  style_key: string | null;
  style_label: string | null;
  prompt: string;
  headline: string | null;
  file_name: string;
  mime: string;
  bytes: number;
  selected: number;
  rating: Rating | null;
  rated_at: number | null;
  created_at: number;
}

export function rowToImage(r: ImageRow): ImageRecord {
  return {
    id: r.id,
    postId: r.post_id,
    savedPostId: r.saved_post_id,
    source: r.source,
    styleKey: r.style_key,
    styleLabel: r.style_label,
    prompt: r.prompt,
    headline: r.headline,
    mime: r.mime,
    bytes: r.bytes,
    selected: r.selected === 1,
    rating: r.rating,
    ratedAt: r.rated_at,
    createdAt: r.created_at,
    url: `/api/images/${r.id}`,
  };
}

export interface ImageFileRef {
  id: string;
  fileName: string;
  mime: string;
}

export function insertImage(input: {
  id?: string;
  postId?: string | null;
  savedPostId?: string | null;
  source: ImageSource;
  styleKey?: string | null;
  styleLabel?: string | null;
  prompt: string;
  headline?: string | null;
  fileName: string;
  mime: string;
  bytes: number;
}): ImageRecord {
  const id = input.id ?? newId('img');
  getDb()
    .prepare(
      `INSERT INTO images (id, post_id, saved_post_id, source, style_key, style_label, prompt, headline, file_name, mime, bytes, selected, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      id,
      input.postId ?? null,
      input.savedPostId ?? null,
      input.source,
      input.styleKey ?? null,
      input.styleLabel ?? null,
      input.prompt,
      input.headline ?? null,
      input.fileName,
      input.mime,
      input.bytes,
      now(),
    );
  return getImage(id)!;
}

export function getImage(id: string): ImageRecord | null {
  const row = getDb().prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow | undefined;
  return row ? rowToImage(row) : null;
}

export function getImageFile(id: string): ImageFileRef | null {
  const row = getDb().prepare('SELECT id, file_name, mime FROM images WHERE id = ?').get(id) as
    | { id: string; file_name: string; mime: string }
    | undefined;
  return row ? { id: row.id, fileName: row.file_name, mime: row.mime } : null;
}

export function listImagesForPost(postId: string): ImageRecord[] {
  const rows = getDb().prepare('SELECT * FROM images WHERE post_id = ? ORDER BY created_at ASC').all(postId) as ImageRow[];
  return rows.map(rowToImage);
}

export function listImagesForSaved(savedPostId: string): ImageRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM images WHERE saved_post_id = ? ORDER BY created_at ASC')
    .all(savedPostId) as ImageRow[];
  return rows.map(rowToImage);
}

export function listStudioImages(limit = 60): ImageRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM images WHERE source = 'studio' ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as ImageRow[];
  return rows.map(rowToImage);
}

export function markImageSelected(id: string) {
  const img = getImage(id);
  if (!img) return;
  const db = getDb();
  db.transaction(() => {
    if (img.postId) db.prepare('UPDATE images SET selected = 0 WHERE post_id = ?').run(img.postId);
    if (img.savedPostId) db.prepare('UPDATE images SET selected = 0 WHERE saved_post_id = ?').run(img.savedPostId);
    db.prepare('UPDATE images SET selected = 1 WHERE id = ?').run(id);
  })();
}

export function rateImage(id: string, rating: Rating): ImageRecord | null {
  getDb().prepare('UPDATE images SET rating = ?, rated_at = ? WHERE id = ?').run(rating, now(), id);
  return getImage(id);
}

export function deleteImageRow(id: string): ImageFileRef | null {
  const ref = getImageFile(id);
  if (!ref) return null;
  getDb().prepare('DELETE FROM images WHERE id = ?').run(id);
  return ref;
}

export function listAllImageFiles(): ImageFileRef[] {
  const rows = getDb().prepare('SELECT id, file_name, mime FROM images').all() as Array<{
    id: string;
    file_name: string;
    mime: string;
  }>;
  return rows.map((r) => ({ id: r.id, fileName: r.file_name, mime: r.mime }));
}

// ---------- إحصائيات الأنماط ----------

export function bumpStyleStat(styleKey: string, field: 'shown' | 'selected' | 'liked' | 'disliked', by = 1) {
  getDb()
    .prepare(
      `INSERT INTO image_style_stats (style_key, ${field}) VALUES (?, ?)
       ON CONFLICT(style_key) DO UPDATE SET ${field} = ${field} + excluded.${field}`,
    )
    .run(styleKey, by);
}

export function listStyleStats(): StyleStat[] {
  const rows = getDb().prepare('SELECT * FROM image_style_stats').all() as Array<{
    style_key: string;
    shown: number;
    selected: number;
    liked: number;
    disliked: number;
  }>;
  return rows.map((r) => ({ styleKey: r.style_key, shown: r.shown, selected: r.selected, liked: r.liked, disliked: r.disliked }));
}

export function countImageRatings(): { liked: number; disliked: number } {
  const r = getDb()
    .prepare(
      `SELECT SUM(CASE WHEN rating = 'liked' THEN 1 ELSE 0 END) AS liked,
              SUM(CASE WHEN rating = 'disliked' THEN 1 ELSE 0 END) AS disliked
       FROM images`,
    )
    .get() as { liked: number | null; disliked: number | null };
  return { liked: r.liked ?? 0, disliked: r.disliked ?? 0 };
}
