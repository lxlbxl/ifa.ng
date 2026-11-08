import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BabalawoProfile } from '@/types/babalawo';
import { errorService } from '@/services/errorService';

export const useBabalawoById = (babalawoId: string | undefined) => {
  const [babalawo, setBabalawo] = useState<BabalawoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!babalawoId) {
      setLoading(false);
      return;
    }

    const fetchBabalawo = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('[useBabalawoById] Fetching babalawo:', babalawoId);
        
        // Fetch babalawo data using RPC function for consistency
        const { data, error } = await supabase.rpc('get_public_babalawos');

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          setBabalawo(null);
          return;
        }

        // Find the specific babalawo
        const foundBabalawo = data.find(b => b.id === babalawoId);
        
        if (!foundBabalawo) {
          setBabalawo(null);
          return;
        }

        // Transform to match our interface
        const transformedBabalawo: BabalawoProfile = {
          id: foundBabalawo.id,
          full_name: foundBabalawo.full_name?.trim() || 'Babalawo (Name Missing)',
          avatar_url: foundBabalawo.avatar_url,
          specialties: foundBabalawo.specialties || [],
          experience_years: foundBabalawo.experience_years || 1,
          hourly_rate: Number(foundBabalawo.hourly_rate) || 15000,
          bio: foundBabalawo.bio || '',
          verification_status: foundBabalawo.verification_status || 'pending',
          rating: Number(foundBabalawo.rating) || 5.0,
          total_sessions: foundBabalawo.total_sessions || 0,
          languages: foundBabalawo.languages || ['English'],
          timezone: foundBabalawo.timezone || 'Africa/Lagos',
          is_active: foundBabalawo.is_active ?? true,
        };

        console.log('[useBabalawoById] Found babalawo:', transformedBabalawo);
        setBabalawo(transformedBabalawo);
        
      } catch (err: any) {
        console.error('[useBabalawoById] Error fetching babalawo:', err);
        const appError = errorService.handleError(err, 'FETCH_BABALAWO_BY_ID');
        setError(appError.message);
        setBabalawo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBabalawo();
  }, [babalawoId]);

  return { babalawo, loading, error };
};