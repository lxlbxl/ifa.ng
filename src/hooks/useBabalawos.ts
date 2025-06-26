import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BabalawoProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialties: string[] | null;
  experience_years: number | null;
  hourly_rate: number | null;
  bio: string | null;
  verification_status: string | null;
  rating: number | null;
  total_sessions: number | null;
  languages: string[] | null;
  timezone: string | null;
  is_active: boolean | null;
}

export const useBabalawos = () => {
  const [babalawos, setBabalawos] = useState<BabalawoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBabalawos = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch babalawos
        const { data: babalawosData, error: babalawosError } = await supabase
          .from('babalawos')
          .select(`
            id,
            specialties,
            experience_years,
            hourly_rate,
            bio,
            verification_status,
            rating,
            total_sessions,
            languages,
            timezone,
            is_active
          `)
          .eq('verification_status', 'approved')
          .eq('is_active', true);

        if (babalawosError) {
          throw babalawosError;
        }

        // Fetch profiles separately
        const babalawoIds = babalawosData?.map(b => b.id) ?? [];

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', babalawoIds);

        if (profilesError) {
          throw profilesError;
        }

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) ?? []);

        const mergedData = (babalawosData ?? []).map(b => ({
          ...b,
          full_name: profilesMap.get(b.id)?.full_name ?? null,
          avatar_url: profilesMap.get(b.id)?.avatar_url ?? null,
        }));

        setBabalawos(mergedData);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchBabalawos();
  }, []);

  return { babalawos, loading, error };
};
