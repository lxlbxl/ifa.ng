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
        // Fetch babalawos with profile data joined
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
            is_active,
            profiles (
              full_name,
              avatar_url
            )
          `)
          .eq('verification_status', 'approved')
          .eq('is_active', true);

        if (babalawosError) {
          throw babalawosError;
        }

        // Transform data to flatten profiles into full_name and avatar_url fields
        const transformedData: BabalawoProfile[] = (babalawosData ?? []).map(b => ({
          id: b.id,
          specialties: b.specialties,
          experience_years: b.experience_years,
          hourly_rate: b.hourly_rate,
          bio: b.bio,
          verification_status: b.verification_status,
          rating: b.rating,
          total_sessions: b.total_sessions,
          languages: b.languages,
          timezone: b.timezone,
          is_active: b.is_active,
          full_name: b.profiles?.[0]?.full_name ?? null,
          avatar_url: b.profiles?.[0]?.avatar_url ?? null,
        }));

        setBabalawos(transformedData);
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
