import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { addRule, getSpec, insertImage, insertPost, insertSaved, listPostsByRating, setSetting, updateSaved } from '@/lib/db/repo';
import { normalizeText } from '@/lib/text';
import { decodeBase64Image, saveImageFile } from '@/lib/images/storage';
import { seedPosts } from './onboarding';

/** شكل ذاكرة النسخة القديمة (localStorage: basma-memory) — كل الحقول اختيارية */
const LegacyPost = z.object({ id: z.string().optional(), content: z.string(), topic: z.string().optional(), image: z.string().nullable().optional() });
export const LegacyMemorySchema = z.object({
  spec: z.string().optional(),
  goldenRules: z.array(z.string()).optional(),
  avoidRules: z.array(z.string()).optional(),
  dislikeReasons: z.array(z.string()).optional(),
  likedPosts: z.array(LegacyPost).optional(),
  dislikedPosts: z.array(LegacyPost).optional(),
  imageStyleRules: z.array(z.string()).optional(),
  imageAvoidRules: z.array(z.string()).optional(),
  savedPosts: z.array(LegacyPost.extend({ savedAt: z.number().optional() })).optional(),
});
export type LegacyMemory = z.infer<typeof LegacyMemorySchema>;

export interface ImportReport {
  spec: boolean;
  rules: number;
  liked: number;
  disliked: number;
  saved: number;
  images: number;
  skipped: number;
}

export function importLegacyMemory(mem: LegacyMemory): ImportReport {
  const report: ImportReport = { spec: false, rules: 0, liked: 0, disliked: 0, saved: 0, images: 0, skipped: 0 };
  const db = getDb();

  db.transaction(() => {
    if (mem.spec?.trim() && !getSpec()) {
      setSetting('spec', mem.spec.trim());
      setSetting('onboarded_at', String(Date.now()));
      report.spec = true;
    }
    seedPosts();

    const addAll = (kind: 'golden' | 'avoid' | 'image_style' | 'image_avoid', items?: string[]) => {
      for (const t of items ?? []) if (addRule(kind, t, 'imported')) report.rules++;
    };
    addAll('golden', mem.goldenRules);
    addAll('avoid', mem.avoidRules);
    addAll('avoid', mem.dislikeReasons);
    addAll('image_style', mem.imageStyleRules);
    addAll('image_avoid', mem.imageAvoidRules);

    const existing = new Set(listPostsByRating('liked', 1000).map((p) => normalizeText(p.content)));
    const ts = Date.now();
    for (const p of mem.likedPosts ?? []) {
      const norm = normalizeText(p.content);
      if (!norm || existing.has(norm)) {
        report.skipped++;
        continue;
      }
      existing.add(norm);
      insertPost({ kind: p.id?.startsWith('seed-') ? 'seed' : 'reference', content: p.content, topic: p.topic ?? 'مستورد', rating: 'liked', ratedAt: ts, createdAt: ts });
      report.liked++;
    }
    for (const p of mem.dislikedPosts ?? []) {
      if (!p.content.trim()) continue;
      insertPost({ kind: 'imported', content: p.content, topic: p.topic ?? 'مستورد', rating: 'disliked', ratedAt: ts, createdAt: ts });
      report.disliked++;
    }
  })();

  // الصور تُكتب على القرص خارج المعاملة
  for (const sp of mem.savedPosts ?? []) {
    if (!sp.content.trim()) continue;
    const saved = insertSaved({ content: sp.content, topic: sp.topic ?? '', createdAt: sp.savedAt ?? Date.now() });
    report.saved++;
    if (sp.image && sp.image.startsWith('data:image/')) {
      try {
        const { buffer, mime } = decodeBase64Image(sp.image);
        if (buffer.length > 0) {
          const file = saveImageFile(buffer, mime);
          const img = insertImage({ id: file.id, savedPostId: saved.id, source: 'saved', prompt: 'مستورد من النسخة القديمة', fileName: file.fileName, mime, bytes: file.bytes });
          updateSaved(saved.id, { imageId: img.id });
          report.images++;
        }
      } catch (err) {
        console.error('[import] image failed', err);
      }
    }
  }
  return report;
}
