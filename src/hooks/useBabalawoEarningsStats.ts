import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const fetchBabalawoEarningsStats = async (babalawoId: string) => {
  // Fetch all-time earnings from completed sessions
  const { data: allTimeSessions } = await supabase
    .from('sessions')
    .select('amount')
    .eq('babalawo_id', babalawoId)
    .eq('status', 'completed');

  const allTimeEarnings = allTimeSessions?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

  // Calculate available balance as total earnings minus sum of paid payouts
  const { data: paidPayouts } = await supabase
    .from('payouts')
    .select('amount')
    .eq('babalawo_id', babalawoId)
    .eq('status', 'paid');

  const totalPaidPayouts = paidPayouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  const availableBalance = allTimeEarnings - totalPaidPayouts;

  // Fetch pending payouts
  const { data: pendingPayoutsData } = await supabase
    .from('payouts')
    .select('amount')
    .eq('babalawo_id', babalawoId)
    .eq('status', 'pending');

  const pendingPayouts = pendingPayoutsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  // Withdrawal requests are not separately modeled; assume pending payouts represent them
  const withdrawalRequests = pendingPayoutsData || [];

  // Fetch payout history (paid payouts)
  const { data: payoutHistory } = await supabase
    .from('payouts')
    .select('id, amount, method, reference, created_at')
    .eq('babalawo_id', babalawoId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  // Commission rates are not in schema; set default values
  const commissionRates = {
    platformPercent: 20,
    babalawoPercent: 80,
  };

  return {
    allTimeEarnings,
    availableBalance,
    pendingPayouts,
    withdrawalRequests,
    payoutHistory: payoutHistory || [],
    commissionRates,
  };
};

export const useBabalawoEarningsStats = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['babalawoEarningsStats', user?.id],
    queryFn: () => (user?.id ? fetchBabalawoEarningsStats(user.id) : null),
    enabled: !!user?.id,
  });
};
