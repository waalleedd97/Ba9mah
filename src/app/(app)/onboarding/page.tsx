import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { isOnboarded } from '@/lib/db/repo';
import { AVOID_OPTIONS, DEFAULT_SPEC, FIELD_OPTIONS, LANGUAGE_OPTIONS, VOICE_TRAITS } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  if (isOnboarded()) redirect('/');
  return <OnboardingWizard fields={FIELD_OPTIONS} voices={VOICE_TRAITS} languages={LANGUAGE_OPTIONS} avoids={AVOID_OPTIONS} defaultSpec={DEFAULT_SPEC} />;
}
