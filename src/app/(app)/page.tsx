import { Dashboard } from '@/components/Dashboard';
import { latestProfile, latestRound, listRoundSummaries, ruleTexts } from '@/lib/db/repo';
import { isLearning } from '@/lib/ai/learn';
import { requireOnboarded } from '@/lib/guards';
import { topicSuggestions } from '@/lib/seed';
import { getAppStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  requireOnboarded();
  const stats = getAppStats();
  const profile = latestProfile();
  return (
    <Dashboard
      stats={stats}
      profile={profile}
      goldenRules={ruleTexts('golden')}
      currentRound={latestRound()}
      recent={listRoundSummaries(5)}
      suggestions={topicSuggestions(stats.spec, profile?.data.topics_that_work ?? [])}
      learning={isLearning()}
    />
  );
}
