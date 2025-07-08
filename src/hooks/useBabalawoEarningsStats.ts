import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BabalawoEarningsStats } from '@/types/earnings';
import { useAuth } from './useAuth';

const fetchBabalawoEarningsStats = async (babalawoId: string): Promise<BabalawoEarningsStats> => {
  const { data, error } = await supabase.rpc('get_babalawo_earnings_stats', {
    p_babalawo_id: babalawoId,
  });

  if (error) {
    console.error('Error fetching Babalawo earnings stats:', error);
    throw new Error(error.message);
  }

  return data as unknown as BabalawoEarningsStats;
};

export const useBabalawoEarningsStats = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['babalawoEarningsStats', user?.id],
    queryFn: () => (user?.id ? fetchBabalawoEarningsStats(user.id) : null),
    enabled: !!user?.id,
  });
};
