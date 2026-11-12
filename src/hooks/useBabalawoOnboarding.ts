import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/** What a Babalawo still needs before clients can find and book them (checked by the server). */
export interface Onboarding {
  photo: boolean; price: boolean; hours: boolean; bio: boolean;
  bank: boolean; google_email: boolean; verified: boolean; active: boolean; listed: boolean;
}

export const ONBOARDING_KEY = 'babalawo-onboarding';

export function useBabalawoOnboarding() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [ONBOARDING_KEY, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('babalawo_onboarding', {});
      if (error) throw error;
      return data as Onboarding | null;
    },
  });
}
