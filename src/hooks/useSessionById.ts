
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSessionById = (sessionId: string) => {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('sessions')
        .select(
          `
            *,
            user:profiles!sessions_user_id_fkey(id, full_name, avatar_url),
            babalawo:profiles!sessions_babalawo_id_fkey(id, full_name, avatar_url)
          `
        )
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });
};
