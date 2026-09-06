import { MobileBars, SidebarNav } from '@/components/shell/SidebarNav';
import { countSaved, getSpec, isOnboarded } from '@/lib/db/repo';
import { isLearning } from '@/lib/ai/learn';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isOnboarded()) return <>{children}</>;
  const saved = countSaved();
  return (
    <div className="shell">
      <SidebarNav savedCount={saved} spec={getSpec()} learning={isLearning()} mock={getEnv().mockAi} build={getEnv().BASMA_BUILD_SHA} />
      <div className="main">
        <MobileBars savedCount={saved} />
        {children}
      </div>
    </div>
  );
}
