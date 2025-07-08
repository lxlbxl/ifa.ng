import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';


const fetchBabalawoDashboardStats = async (babalawoId: string) => {
  const { data, error } = await supabase
    .rpc('get_babalawo_dashboard_stats', { p_babalawo_id: babalawoId });

  if (error) {
    console.error('Error fetching Babalawo dashboard stats:', error);
    throw new Error(error.message);
  }

  // Fallback for notifications if empty
  if (!data.notifications || data.notifications.length === 0) {
    data.notifications = [
      { id: '1', type: "booking", message: "You have no new notifications.", action_label: "", action_url: "", created_at: "", read: false, timestamp: "", title: "", user_id: "" },
    ];
  }

  return data;
};

export const useBabalawoDashboardStats = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['babalawoDashboardStats', user?.id],
    queryFn: () => user?.id ? fetchBabalawoDashboardStats(user.id) : null,
    enabled: !!user?.id,
    refetchInterval: 60000 // Refetch every minute to keep countdown accurate
  });
};
