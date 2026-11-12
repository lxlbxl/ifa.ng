import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InsightMetric {
  value: number | string | null;
  /** Same metric over the previous period (period metrics only). */
  prev?: number | null;
  /** 12 points across the current period, oldest first (period metrics only). */
  spark?: number[] | null;
}

export interface AdminInsights {
  section: string;
  days: number;
  generated_at: string;
  metrics: Record<string, InsightMetric>;
}

/** Numbers for the insight cards on one admin page (admin_insights RPC, admin only). */
export const useAdminInsights = (section: string, days: number, enabled = true) =>
  useQuery({
    queryKey: ['adminInsights', section, days],
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_insights' as never, { p_section: section, p_days: days } as never);
      if (error) throw new Error(error.message);
      return data as AdminInsights;
    },
  });
