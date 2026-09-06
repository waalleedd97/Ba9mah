import 'server-only';
import { countByRating, countRounds, countRules, countSaved, getSpec, isOnboarded, latestProfile } from '@/lib/db/repo';
import { explorationCount } from '@/lib/ai/prompts';
import { ratingsSinceProfile } from '@/lib/ai/learn';
import type { AppStats } from '@/lib/types';

export function getAppStats(): AppStats {
  const liked = countByRating('liked');
  const rounds = countRounds();
  const profile = latestProfile();
  return {
    spec: getSpec(),
    onboarded: isOnboarded(),
    liked,
    disliked: countByRating('disliked'),
    rounds,
    goldenRules: countRules('golden'),
    avoidRules: countRules('avoid'),
    imageRules: countRules('image_style') + countRules('image_avoid'),
    saved: countSaved(),
    profileVersion: profile?.version ?? null,
    profileConfidence: profile?.data.confidence ?? null,
    exploratoryNext: explorationCount(liked, rounds),
    ratingsSinceProfile: ratingsSinceProfile(),
  };
}
