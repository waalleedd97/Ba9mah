import { TrainPanel } from '@/components/TrainPanel';
import { listPostsByRating, listRules } from '@/lib/db/repo';
import { requireOnboarded } from '@/lib/guards';

export const dynamic = 'force-dynamic';

export default function TrainPage() {
  requireOnboarded();
  return <TrainPanel rules={listRules(undefined, false)} liked={listPostsByRating('liked', 300)} />;
}
