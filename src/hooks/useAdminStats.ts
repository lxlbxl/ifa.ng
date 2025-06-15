
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchAdminStats = async () => {
  const { count: totalUsers, error: usersError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'user');

  const { count: totalBabalawos, error: babalawosError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'babalawo');

  const { count: totalSessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true });

  if (usersError || babalawosError || sessionsError) {
    console.error('Error fetching admin stats:', usersError || babalawosError || sessionsError);
    throw new Error('Could not fetch admin statistics');
  }

  return { totalUsers, totalBabalawos, totalSessions };
};

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
  });
};
