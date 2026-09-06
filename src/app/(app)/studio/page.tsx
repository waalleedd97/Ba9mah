import { Studio } from '@/components/Studio';
import { countRules, listStudioImages } from '@/lib/db/repo';
import { requireOnboarded } from '@/lib/guards';

export const dynamic = 'force-dynamic';

export default function StudioPage() {
  requireOnboarded();
  return <Studio initialImages={listStudioImages()} styleRuleCount={countRules('image_style')} />;
}
