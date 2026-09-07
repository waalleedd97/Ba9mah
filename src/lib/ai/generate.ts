import 'server-only';
import {
  countByRating,
  countRounds,
  createRound,
  getSpec,
  insertPost,
  latestProfile,
  listDislikedWithReasons,
  listPostsByRating,
  recentTopics,
  ruleTexts,
} from '@/lib/db/repo';
import type { Post, Round } from '@/lib/types';
import { AIError, structuredCall } from './gemini';
import { GenerationSchema } from './schemas';
import { buildGenerationSystem, buildGenerationUser, explorationCount, selectExamples } from './prompts';
import { verifyIfNeeded } from './labor-law';

export interface GeneratedRound {
  round: Round;
  posts: Post[];
}

/** توليد جولة جديدة من 4 بوستات وحفظها */
export async function generateRound(topicInput?: string | null): Promise<GeneratedRound> {
  const spec = getSpec();
  if (!spec) throw new AIError('أكمل الإعداد الأولي أولاً', 'config');
  const topic = topicInput?.trim() ? topicInput.trim().slice(0, 200) : null;

  const liked = listPostsByRating('liked', 80);
  const disliked = listDislikedWithReasons(4);
  const profile = latestProfile();
  const goldenRules = ruleTexts('golden');
  const avoidRules = ruleTexts('avoid');
  const roundsSoFar = countRounds();
  const exploratory = explorationCount(countByRating('liked'), roundsSoFar);

  const system = buildGenerationSystem({ spec, profile, goldenRules, avoidRules });
  const user = buildGenerationUser({
    topic,
    examples: selectExamples(liked, topic ?? undefined, 6),
    disliked,
    recentTopics: recentTopics(24),
    exploratory,
    roundNumber: roundsSoFar + 1,
  });

  const { data, usage, model } = await structuredCall({
    kind: 'generate',
    schema: GenerationSchema,
    system,
    user,
    effort: 'high',
    maxTokens: 16000,
    mockHint: topic ?? undefined,
  });

  const drafts = data.posts.filter((p) => p.content.trim().length > 0).slice(0, 4);
  if (drafts.length === 0) throw new AIError('لم يرجع النموذج أي بوست صالح', 'parse');

  const verification = await verifyIfNeeded(
    spec,
    drafts.map((p) => ({ topic: p.topic, content: p.content })),
  );

  const round = createRound({ topic, exploratory, model, usage });
  const posts = drafts.map((p, i) => {
    const v = verification.get(i);
    return insertPost({
      roundId: round.id,
      position: i,
      kind: 'generated',
      content: v?.content ?? p.content,
      topic: p.topic.trim() || (topic ?? 'بدون عنوان'),
      angle: p.angle,
      hookType: p.hook_type,
      exploratory: p.exploratory,
      verified: Boolean(v),
      verificationNote: v?.note ?? null,
    });
  });

  return { round, posts };
}
