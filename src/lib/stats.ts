import 'server-only';
import { countByKind, countRatedNotOwn, countRounds, countRules, countSaved, getSpec, isOnboarded, latestProfile } from '@/lib/db/repo';
import { explorationCount } from '@/lib/ai/prompts';
import { ratingsSinceProfile } from '@/lib/ai/learn';
import type { AppStats } from '@/lib/types';

export function getAppStats(): AppStats {
  const liked = countRatedNotOwn('liked');
  const own = countByKind('own');
  const rounds = countRounds();
  const profile = latestProfile();
  return {
    spec: getSpec(),
    onboarded: isOnboarded(),
    liked,
    own,
    disliked: countRatedNotOwn('disliked'),
    rounds,
    goldenRules: countRules('golden'),
    avoidRules: countRules('avoid'),
    imageRules: countRules('image_style') + countRules('image_avoid'),
    saved: countSaved(),
    profileVersion: profile?.version ?? null,
    profileConfidence: profile?.data.confidence ?? null,
    exploratoryNext: explorationCount(liked + own, rounds),
    ratingsSinceProfile: ratingsSinceProfile(),
  };
}
