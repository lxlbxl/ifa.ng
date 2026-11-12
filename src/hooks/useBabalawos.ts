import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BabalawoProfile } from '@/types/babalawo';
import { errorService } from '@/services/errorService';

export const useBabalawos = () => {
  const [babalawos, setBabalawos] = useState<BabalawoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBabalawos = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('[useBabalawos] Calling get_public_babalawos RPC...');
        
        const { data, error } = await supabase.rpc('get_public_babalawos');

        if (error) {
          throw error;
        }

        console.log('[useBabalawos] Data from RPC:', data);

        if (!data || data.length === 0) {
          console.log('[useBabalawos] No babalawos found from RPC.');
          setBabalawos([]);
          return;
        }

        // Transform data to match our interface, ensuring correct types and fallbacks
        const transformedData: BabalawoProfile[] = data.map(b => ({
          id: b.id,
          full_name: b.full_name?.trim() || 'Babalawo (Name Missing)',
          avatar_url: b.avatar_url,
          specialties: b.specialties || [],
          experience_years: b.experience_years || 1,
          hourly_rate: Number(b.hourly_rate) || 15000,
          usd_price: b.usd_price != null ? Number(b.usd_price) : null,
          usd_instant_price: b.usd_instant_price != null ? Number(b.usd_instant_price) : null,
          instant_price: b.instant_price != null ? Number(b.instant_price) : null,
          bio: b.bio || '',
          verification_status: b.verification_status || 'pending',
          rating: Number(b.rating) || 5.0,
          total_sessions: b.total_sessions || 0,
          languages: b.languages || ['English'],
          timezone: b.timezone || 'Africa/Lagos',
          is_active: b.is_active ?? true,
        }));

        console.log('[useBabalawos] Transformed data:', transformedData);
        setBabalawos(transformedData);
        
      } catch (err: any) {
        console.error('[useBabalawos] Error fetching babalawos via RPC:', err);
        const appError = errorService.handleError(err, 'FETCH_BABALAWOS_RPC');
        setError(appError.message);
        errorService.showErrorToast(appError);
      } finally {
        setLoading(false);
      }
    };

    fetchBabalawos();
  }, []);

  // Retry function for manual retry
  const retry = () => {
    const fetchBabalawos = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch babalawos first
        const { data: babalawosData, error: babalawosError } = await supabase
          .from('babalawos')
          .select(`
            user_id,
            specialties,
            experience_years,
            hourly_rate,
            bio,
            is_verified,
            rating,
            total_sessions,
            languages,
            timezone,
            is_active
          `)
          .eq('is_verified', true)
          .eq('is_active', true);

        if (babalawosError) {
          throw babalawosError;
        }

        if (!babalawosData || babalawosData.length === 0) {
          setBabalawos([]);
          return;
        }

        // Fetch profiles for these babalawos
        const babalawoIds = babalawosData.map(b => b.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', babalawoIds);

        if (profilesError) {
          console.warn('[useBabalawos] Error fetching profiles on retry:', profilesError);
        }

        // Create a map of profiles for quick lookup
        const profilesMap = new Map();
        (profilesData || []).forEach(profile => {
          profilesMap.set(profile.id, profile);
        });

        const transformedData: BabalawoProfile[] = babalawosData.map(b => {
          const profile = profilesMap.get(b.user_id);
          let fullName = 'Babalawo (Name Missing)';
          
          if (profile?.full_name && profile.full_name.trim() !== '') {
            fullName = profile.full_name.trim();
          }
          
          return {
            id: b.user_id,
            full_name: fullName,
            avatar_url: profile?.avatar_url || null,
            specialties: b.specialties || [],
            experience_years: b.experience_years || 1,
            hourly_rate: b.hourly_rate || 15000,
            bio: b.bio || '',
            verification_status: b.is_verified ? 'approved' : 'pending',
            rating: b.rating || 5.0,
            total_sessions: b.total_sessions || 0,
            languages: b.languages || ['English'],
            timezone: b.timezone || 'Africa/Lagos',
            is_active: b.is_active ?? true,
          };
        });

        setBabalawos(transformedData);
        
      } catch (err: any) {
        const appError = errorService.handleError(err, 'RETRY_FETCH_BABALAWOS');
        setError(appError.message);
        errorService.showErrorToast(appError);
      } finally {
        setLoading(false);
      }
    };

    fetchBabalawos();
  };

  return { babalawos, loading, error, retry };
};
