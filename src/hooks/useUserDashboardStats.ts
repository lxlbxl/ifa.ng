
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

  // Fetch wallet balance: sum of payments - sum of refunds for the user
  // Find all successful payments made by this user
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, status, user_id')
    .eq('user_id', userId)
    .eq('status', 'successful');
  // Find all successful refunds made to this user
  const { data: refunds } = await supabase
    .from('refunds')
    .select('amount, status')
    .eq('status', 'approved');

  const totalPaid =
    payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
  const totalRefunded =
    refunds?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;

  const walletBalance = totalPaid - totalRefunded;

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
