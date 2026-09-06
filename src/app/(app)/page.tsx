import { Dashboard } from '@/components/Dashboard';
import { latestProfile, latestRound, ruleTexts } from '@/lib/db/repo';
import { requireOnboarded } from '@/lib/guards';
import { getAppStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  requireOnboarded();
  return <Dashboard stats={getAppStats()} profile={latestProfile()} goldenRules={ruleTexts('golden')} currentRound={latestRound()} />;
}
