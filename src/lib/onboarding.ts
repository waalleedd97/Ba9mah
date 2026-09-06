import 'server-only';
import { getDb } from '@/lib/db';
import { addRule, insertPost, postExists, setSetting } from '@/lib/db/repo';
import { ONBOARD_QUESTIONS, SEED_POSTS } from '@/lib/seed';

/** يحفظ التخصص، يحوّل إجابات A/B إلى قواعد ذهبية، ويزرع أمثلة البذرة */
export function completeOnboarding(spec: string, choices: Array<'a' | 'b'>) {
  const db = getDb();
  db.transaction(() => {
    setSetting('spec', spec.trim());
    choices.forEach((choice, i) => {
      const q = ONBOARD_QUESTIONS[i];
      if (!q) return;
      addRule('golden', (choice === 'a' ? q.a : q.b).rule, 'onboarding');
    });
    seedPosts();
    setSetting('onboarded_at', String(Date.now()));
  })();
}

export function seedPosts() {
  const ts = Date.now();
  for (const s of SEED_POSTS) {
    if (postExists(s.id)) continue;
    insertPost({ id: s.id, kind: 'seed', content: s.content, topic: s.topic, rating: 'liked', ratedAt: ts, createdAt: ts });
  }
}
