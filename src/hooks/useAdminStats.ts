
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetch total users, total babalawos, total sessions (by status), and top babalawos (by rating/bookings)
const fetchAdminStats = async () => {
  // Total Users & Babalawos counts
  const [{ count: totalUsers, error: usersError }, { count: totalBabalawos, error: babalawosError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'babalawo'),
  ]);

  // Session counts
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  const sessionCounts: Record<string, number> = {};

  await Promise.all(statuses.map(async (status) => {
    const { count, error } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    sessionCounts[status] = count ?? 0;
    if (error) throw error;
  }));

  // Grab top babalawos (by rating), limit 5
  const { data: topBabalawos, error: topBabalawosError } = await supabase
    .from('babalawos')
    .select(`
      id,
      rating,
      total_sessions,
      specialties,
      bio,
      profiles:profiles!babalawos_id_fkey(id, full_name, avatar_url)
    `)
    .order('rating', { ascending: false })
    .limit(5);

  if (usersError || babalawosError || topBabalawosError) {
    throw new Error("Error fetching admin statistics");
  }

  // Calculate session success rate (% completed / total sessions)
  const totalSessions = Object.values(sessionCounts).reduce((sum, n) => sum + n, 0);
  const completedSessions = sessionCounts.completed || 0;
  const sessionSuccessRate = totalSessions
    ? Math.round((completedSessions / totalSessions) * 100)
    : 0;

  return {
    totalUsers,
    totalBabalawos,
    totalSessions,
    sessionCounts,
    sessionSuccessRate,
    topBabalawos: topBabalawos?.map(baba => ({
      id: baba.id,
      rating: baba.rating,
      total_sessions: baba.total_sessions,
      specialties: baba.specialties,
      bio: baba.bio,
      full_name: baba.profiles?.full_name,
      avatar_url: baba.profiles?.avatar_url,
    })) ?? [],
  };
};

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
  });
};
