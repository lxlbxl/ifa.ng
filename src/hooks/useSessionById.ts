
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSessionById = (sessionId: string) => {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          user_id,
          babalawo_id,
          session_date,
          start_time,
          end_time,
          status,
          amount,
          payment_status,
          payment_reference,
          notes,
          is_instant,
          user_timezone,
          agora_channel_name,
          room_url,
          primary_odu,
          other_odus,
          ritual_recommendations,
          items_needed,
          deadline,
          next_appointment,
          warning
        `)
        .eq('id', parseInt(sessionId))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });
};
