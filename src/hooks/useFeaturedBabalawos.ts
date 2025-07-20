import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BabalawoProfile } from '@/types/babalawo';
import { errorService } from '@/services/errorService';

export const useFeaturedBabalawos = () => {
  const [babalawos, setBabalawos] = useState<BabalawoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeaturedBabalawos = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('[useFeaturedBabalawos] Calling get_public_babalawos RPC...');
        
        const { data, error } = await supabase.rpc('get_public_babalawos');

        if (error) {
          throw error;
        }

        console.log('[useFeaturedBabalawos] Data from RPC:', data);

        if (!data || data.length === 0) {
          console.log('[useFeaturedBabalawos] No babalawos found from RPC.');
          setBabalawos([]);
          return;
        }

        // Transform data to match our interface, ensuring correct types and fallbacks
        const transformedData: BabalawoProfile[] = data
          .filter((b: any) => b.rating && b.rating >= 4.5) // Only featured ones with high ratings
          .slice(0, 6) // Limit to 6 featured babalawos
          .map((b: any) => ({
            id: b.id,
            full_name: b.full_name?.trim() || 'Babalawo (Name Missing)',
            avatar_url: b.avatar_url,
            specialties: b.specialties || [],
            experience_years: b.experience_years || 1,
            hourly_rate: Number(b.hourly_rate) || 15000,
            bio: b.bio || '',
            verification_status: b.verification_status || 'pending',
            rating: Number(b.rating) || 5.0,
            total_sessions: b.total_sessions || 0,
            languages: b.languages || ['English'],
            timezone: b.timezone || 'Africa/Lagos',
            is_active: b.is_active ?? true,
          }));

        console.log('[useFeaturedBabalawos] Transformed data:', transformedData);
        setBabalawos(transformedData);
        
      } catch (err: any) {
        console.error('[useFeaturedBabalawos] Error fetching featured babalawos via RPC:', err);
        const appError = errorService.handleError(err, 'FETCH_FEATURED_BABALAWOS_RPC');
        setError(appError.message);
        errorService.showErrorToast(appError);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedBabalawos();
  }, []);

  return { babalawos, loading, error };
};