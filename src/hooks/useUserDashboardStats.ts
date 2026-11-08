
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const fetchUserDashboardStats = async (userId: string | undefined) => {
  if (!userId) return { upcoming: 0, completed: 0, wallet: 0 };

  // Count of upcoming sessions
  const { count: upcomingCount } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['pending', 'confirmed']);

  // Count of completed sessions
  const { count: completedCount } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  // Get wallet balance
  const { data: walletData } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  const walletBalance = walletData?.balance || 0;

  return {
    upcoming: upcomingCount ?? 0,
    completed: completedCount ?? 0,
    wallet: walletBalance,
  };
};

export const useUserDashboardStats = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['userDashboardStats', user?.id],
    queryFn: () => fetchUserDashboardStats(user?.id),
    enabled: !!user,
    staleTime: 60000,
  });
};
