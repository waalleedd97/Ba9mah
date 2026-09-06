import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { isOnboarded } from '@/lib/db/repo';
import { DEFAULT_SPEC, FIELD_OPTIONS, ONBOARD_QUESTIONS } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  if (isOnboarded()) redirect('/');
  return <OnboardingWizard questions={ONBOARD_QUESTIONS} fields={FIELD_OPTIONS} defaultSpec={DEFAULT_SPEC} />;
}
