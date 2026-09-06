import { SavedList } from '@/components/SavedList';
import { listSaved } from '@/lib/db/repo';
import { requireOnboarded } from '@/lib/guards';

export const dynamic = 'force-dynamic';

export default function SavedPage() {
  requireOnboarded();
  return <SavedList initial={listSaved()} />;
}
