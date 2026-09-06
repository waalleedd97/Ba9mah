import { Navbar } from '@/components/Navbar';
import { countSaved, isOnboarded } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const onboarded = isOnboarded();
  return (
    <>
      {onboarded && <Navbar savedCount={countSaved()} />}
      {children}
    </>
  );
}
