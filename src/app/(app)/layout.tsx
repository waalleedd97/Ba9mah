import { MobileBars, SidebarNav } from '@/components/shell/SidebarNav';
import { MockBanner } from '@/components/shell/MockBanner';
import { countSaved, getSpec } from '@/lib/db/repo';
import { isLearning } from '@/lib/ai/learn';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const saved = countSaved();
  const env = getEnv();
  return (
    <div className="shell">
      <SidebarNav savedCount={saved} spec={getSpec()} learning={isLearning()} mock={env.mockAi} build={env.BASMA_BUILD_SHA} />
      <div className="main">
        <MobileBars savedCount={saved} />
        {env.mockAi && <MockBanner />}
        {children}
      </div>
    </div>
  );
}
