
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BabalawoProfile {
  id: string;
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
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export const useFeaturedBabalawos = () => {
  const [babalawos, setBabalawos] = useState<BabalawoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBabalawos = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('[useFeaturedBabalawos] Starting fetch...');
        
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
          .eq('is_active', true)
          .limit(6);

        if (babalawosError) {
          console.error('[useFeaturedBabalawos] Babalawos error:', babalawosError);
          throw babalawosError;
        }
        
        if (!babalawosData) {
          console.log('[useFeaturedBabalawos] No babalawos data returned');
          setBabalawos([]);
          setLoading(false);
          return;
        }

        console.log('[useFeaturedBabalawos] Raw babalawos data:', babalawosData);

        // Fetch profiles separately to avoid relationship issues
        const babalawoIds = babalawosData.map(b => b.id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', babalawoIds);

        if (profilesError) {
          console.error('[useFeaturedBabalawos] Profiles error:', profilesError);
        }

        console.log('[useFeaturedBabalawos] Profiles data:', profilesData);

        // Combine the data
        const transformedData: BabalawoProfile[] = babalawosData.map(babalawo => {
          const profile = profilesData?.find(p => p.id === babalawo.id);
          console.log(`[useFeaturedBabalawos] Processing babalawo ${babalawo.id}, found profile:`, profile);
          
          return {
            ...babalawo,
            profiles: profile ? {
              full_name: profile.full_name,
              avatar_url: profile.avatar_url
            } : null
          };
        });
        
        console.log('[useFeaturedBabalawos] Final transformed data:', transformedData);
        setBabalawos(transformedData);
      } catch (err: any) {
        console.error('[useFeaturedBabalawos] Error:', err);
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchBabalawos();
  }, []);

  return { babalawos, loading, error };
};
