import 'server-only';
import { getDb } from '@/lib/db';
import { addRule, insertOwnPosts, insertPost, postExists, setSetting } from '@/lib/db/repo';
import { AVOID_OPTIONS, LANGUAGE_OPTIONS, SEED_POSTS, VOICE_TRAITS, chipRules } from '@/lib/seed';

export interface OnboardingInput {
  spec: string;
  /** نصوص كتبها المستخدم بنفسه أو يحب أسلوبها */
  samples: string[];
  voice: string[];
  language?: string | null;
  avoid: string[];
}

/** يحفظ التخصص، يحوّل الاختيارات إلى قواعد، ويخزن نصوص المستخدم كبصمة أولى */
function countOwn(): number {
  return (getDb().prepare(`SELECT COUNT(*) AS c FROM posts WHERE kind = 'own'`).get() as { c: number }).c;
}

export function completeOnboarding(input: OnboardingInput): { samples: number } {
  const db = getDb();
  const samples = input.samples.map((s) => s.trim()).filter((s) => s.length >= 20);
  db.transaction(() => {
    setSetting('spec', input.spec.trim());
    for (const r of chipRules(VOICE_TRAITS, input.voice)) addRule('golden', r, 'onboarding');
    if (input.language) for (const r of chipRules(LANGUAGE_OPTIONS, [input.language])) addRule('golden', r, 'onboarding');
    for (const r of chipRules(AVOID_OPTIONS, input.avoid)) addRule('avoid', r, 'onboarding');
    const { added } = insertOwnPosts(samples);
    // أمثلة البذرة فقط عندما لا توجد نصوص من المستخدم
    if (added === 0) seedPosts();
    setSetting('onboarded_at', String(Date.now()));
  })();
  return { samples: countOwn() };
}

export function seedPosts() {
  const ts = Date.now();
  for (const s of SEED_POSTS) {
    if (postExists(s.id)) continue;
    insertPost({ id: s.id, kind: 'seed', content: s.content, topic: s.topic, rating: 'liked', ratedAt: ts, createdAt: ts });
  }
}
