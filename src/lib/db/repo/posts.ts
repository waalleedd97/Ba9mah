import { getDb, now } from '../index';
import { newId } from '@/lib/ids';
import type { Post, PostKind, Rating } from '@/lib/types';

interface PostRow {
  id: string;
  round_id: number | null;
  position: number | null;
  kind: PostKind;
  content: string;
  original_content: string | null;
  topic: string;
  angle: string | null;
  hook_type: string | null;
  exploratory: number;
  rating: Rating | null;
  rated_at: number | null;
  verified: number;
  verification_note: string | null;
  selected_image_id: string | null;
  art_direction_json: string | null;
  created_at: number;
  updated_at: number;
}

export function rowToPost(r: PostRow): Post {
  return {
    id: r.id,
    roundId: r.round_id,
    position: r.position,
    kind: r.kind,
    content: r.content,
    originalContent: r.original_content,
    topic: r.topic,
    angle: r.angle,
    hookType: r.hook_type,
    exploratory: r.exploratory === 1,
    rating: r.rating,
    ratedAt: r.rated_at,
    verified: r.verified === 1,
    verificationNote: r.verification_note,
    selectedImageId: r.selected_image_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface NewPost {
  id?: string;
  roundId?: number | null;
  position?: number | null;
  kind: PostKind;
  content: string;
  originalContent?: string | null;
  topic: string;
  angle?: string | null;
  hookType?: string | null;
  exploratory?: boolean;
  rating?: Rating | null;
  ratedAt?: number | null;
  verified?: boolean;
  verificationNote?: string | null;
  createdAt?: number;
}

export function insertPost(p: NewPost): Post {
  const id = p.id ?? newId('post');
  const ts = p.createdAt ?? now();
  getDb()
    .prepare(
      `INSERT INTO posts (id, round_id, position, kind, content, original_content, topic, angle, hook_type,
                          exploratory, rating, rated_at, verified, verification_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      p.roundId ?? null,
      p.position ?? null,
      p.kind,
      p.content,
      p.originalContent ?? null,
      p.topic,
      p.angle ?? null,
      p.hookType ?? null,
      p.exploratory ? 1 : 0,
      p.rating ?? null,
      p.ratedAt ?? null,
      p.verified ? 1 : 0,
      p.verificationNote ?? null,
      ts,
      ts,
    );
  return getPost(id)!;
}

export function getPost(id: string): Post | null {
  const row = getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined;
  return row ? rowToPost(row) : null;
}

export function postExists(id: string): boolean {
  return Boolean(getDb().prepare('SELECT 1 FROM posts WHERE id = ?').get(id));
}

export function listPostsByRound(roundId: number): Post[] {
  const rows = getDb()
    .prepare('SELECT * FROM posts WHERE round_id = ? ORDER BY position ASC, created_at ASC')
    .all(roundId) as PostRow[];
  return rows.map(rowToPost);
}

export function listPostsByRating(rating: Rating, limit = 200): Post[] {
  const rows = getDb()
    .prepare('SELECT * FROM posts WHERE rating = ? ORDER BY rated_at DESC, created_at DESC LIMIT ?')
    .all(rating, limit) as PostRow[];
  return rows.map(rowToPost);
}

export function countByRating(rating: Rating): number {
  const r = getDb().prepare('SELECT COUNT(*) AS c FROM posts WHERE rating = ?').get(rating) as { c: number };
  return r.c;
}

export function countRatedSince(ts: number): number {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM posts WHERE rating IS NOT NULL AND kind <> 'seed' AND rated_at > ?`)
    .get(ts) as { c: number };
  return r.c;
}

/** آخر المواضيع المولّدة — لتجنب التكرار في الجولات القادمة */
export function recentTopics(limit = 24): string[] {
  const rows = getDb()
    .prepare(`SELECT topic FROM posts WHERE kind = 'generated' AND topic <> '' ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Array<{ topic: string }>;
  return rows.map((r) => r.topic);
}

export function updatePostContent(id: string, content: string, opts?: { keepOriginal?: boolean }): Post | null {
  const current = getPost(id);
  if (!current) return null;
  const original = opts?.keepOriginal !== false && current.originalContent == null ? current.content : current.originalContent;
  getDb()
    .prepare('UPDATE posts SET content = ?, original_content = ?, updated_at = ? WHERE id = ?')
    .run(content, original, now(), id);
  return getPost(id);
}

export function updatePostTopic(id: string, topic: string) {
  getDb().prepare('UPDATE posts SET topic = ?, updated_at = ? WHERE id = ?').run(topic, now(), id);
}

export function ratePost(id: string, rating: Rating): Post | null {
  getDb()
    .prepare('UPDATE posts SET rating = ?, rated_at = ?, updated_at = ? WHERE id = ?')
    .run(rating, now(), now(), id);
  return getPost(id);
}

export function setPostVerification(id: string, content: string, note: string | null) {
  getDb()
    .prepare('UPDATE posts SET content = ?, verified = 1, verification_note = ?, updated_at = ? WHERE id = ?')
    .run(content, note, now(), id);
}

export function setSelectedImage(id: string, imageId: string | null) {
  getDb().prepare('UPDATE posts SET selected_image_id = ?, updated_at = ? WHERE id = ?').run(imageId, now(), id);
}

export function getArtDirection(id: string): string | null {
  const r = getDb().prepare('SELECT art_direction_json FROM posts WHERE id = ?').get(id) as
    | { art_direction_json: string | null }
    | undefined;
  return r?.art_direction_json ?? null;
}

export function setArtDirection(id: string, json: string) {
  getDb().prepare('UPDATE posts SET art_direction_json = ? WHERE id = ?').run(json, id);
}

export function deletePost(id: string) {
  getDb().prepare('DELETE FROM posts WHERE id = ?').run(id);
}

export function addDislikeReason(postId: string, reason: string, category: string | null) {
  getDb()
    .prepare('INSERT INTO dislike_reasons (post_id, reason, category, created_at) VALUES (?, ?, ?, ?)')
    .run(postId, reason, category, now());
}

export interface DislikedWithReason {
  post: Post;
  reasons: string[];
}

export function listDislikedWithReasons(limit = 30): DislikedWithReason[] {
  const posts = listPostsByRating('disliked', limit);
  if (posts.length === 0) return [];
  const stmt = getDb().prepare('SELECT reason FROM dislike_reasons WHERE post_id = ? ORDER BY created_at ASC');
  return posts.map((post) => ({
    post,
    reasons: (stmt.all(post.id) as Array<{ reason: string }>).map((r) => r.reason),
  }));
}

export function recentDislikeReasons(limit = 8): string[] {
  const rows = getDb()
    .prepare('SELECT reason FROM dislike_reasons ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<{ reason: string }>;
  return rows.map((r) => r.reason);
}
