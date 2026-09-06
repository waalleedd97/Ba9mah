import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { isOnboarded } from '@/lib/db/repo';
import { ONBOARD_QUESTIONS, SPEC_OPTIONS } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  if (isOnboarded()) redirect('/');
  return <OnboardingWizard questions={ONBOARD_QUESTIONS} specOptions={SPEC_OPTIONS} />;
}
