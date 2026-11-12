import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eyebrow, Logo } from '@/components/brand';
import { useAuth } from '@/hooks/useAuth';
import { blockingConsents, privacyApi, type PrivacyStatus } from '@/lib/privacy';
import { ConsentForm } from './ConsentForm';

/**
 * Signed-in pages wait until the person has agreed to the current terms and privacy notice,
 * confirmed their age, and given explicit consent for consultation content. People who signed
 * up before this existed, or before the notice changed, see it once.
 */
export function usePrivacyStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['privacy-status', user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: () => privacyApi.status(),
  });
}

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { data } = usePrivacyStatus();
  const qc = useQueryClient();
  const { user } = useAuth();
  const blocking = blockingConsents(data);
  if (!data || blocking.length === 0) return <>{children}</>;
  const isUpdate = blocking.every((m) => m === 'terms' || m === 'privacy_notice');
  return (
    <div className="min-h-screen bg-cloth">
      <div className="wrap max-w-[560px] py-10 md:py-16">
        <div><Logo size="sm" /></div>
        <Eyebrow className="mt-10 text-camwood">{isUpdate ? 'We updated our terms' : 'Your privacy'}</Eyebrow>
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.03em]">
          {isUpdate ? 'Please read and agree to continue' : 'Before you continue'}
        </h1>
        <p className="mb-6 mt-3 text-muted-foreground">
          {isUpdate
            ? 'Our Terms of use and Privacy policy have changed. The links open them in a new tab.'
            : 'Consultations are personal, so we ask for your agreement before you use IFA.ng.'}
        </p>
        <ConsentForm missing={blocking} onDone={(s) => { qc.setQueryData<PrivacyStatus>(['privacy-status', user?.id], s); }} />
      </div>
    </div>
  );
}
