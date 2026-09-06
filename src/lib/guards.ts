import 'server-only';
import { redirect } from 'next/navigation';
import { isOnboarded } from '@/lib/db/repo';

export function requireOnboarded() {
  if (!isOnboarded()) redirect('/onboarding');
}
