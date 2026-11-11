import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { SessionWithBabalawo } from '@/types/babalawo';
import { errorService } from '@/services/errorService';

const fetchUserSessions = async (userId: string | undefined): Promise<SessionWithBabalawo[]> => {
    if (!userId) return [];

    try {
        console.log('[useUserSessions] Fetching sessions for user:', userId);
        
        // Fetch sessions first
        const { data: sessions, error } = await supabase
            .from('sessions')
            .select(`
                id,
                session_date,
                start_time,
                end_time,
                status,
                amount,
                notes,
                babalawo_id,
                primary_odu,
                other_odus,
                ritual_recommendations,
                items_needed,
                deadline,
                next_appointment,
                is_instant,
                session_type
            `)
            .eq('user_id', userId)
            .order('session_date', { ascending: false });

        if (error) {
            throw error;
        }

        console.log('[useUserSessions] Raw sessions data:', sessions);

        if (!sessions || sessions.length === 0) {
            return [];
        }

        // Get unique babalawo IDs from sessions
        const babalawoIds = [...new Set(sessions.map(s => s.babalawo_id))];
        
        // Fetch babalawo details using the new RPC function
        const { data: babalawoDetails, error: rpcError } = await supabase.rpc('get_babalawo_details_by_ids', { p_ids: babalawoIds });

        if (rpcError) {
            console.warn('[useUserSessions] Error fetching babalawo details via RPC:', rpcError);
            // Continue with empty maps if RPC fails
        }

        // Create maps for quick lookup
        const profilesMap = new Map();
        const babalawosMap = new Map();
        (babalawoDetails || []).forEach(detail => {
            profilesMap.set(detail.id, { full_name: detail.full_name, avatar_url: detail.avatar_url });
            babalawosMap.set(detail.id, { specialties: detail.specialties });
        });

        // Transform data to match our standardized interface
        const transformedSessions: SessionWithBabalawo[] = sessions.map(session => {
            const profile = profilesMap.get(session.babalawo_id);
            const babalawoData = babalawosMap.get(session.babalawo_id);
            
            let babalawoName = 'Babalawo (Name Missing)';
            if (profile?.full_name && profile.full_name.trim() !== '') {
                babalawoName = profile.full_name.trim();
            }
            
            console.log(`[useUserSessions] Processing session ${session.id}: babalawo="${babalawoName}"`);
            
            return {
                id: session.id,
                session_date: session.session_date,
                start_time: session.start_time,
                end_time: session.end_time,
                status: session.status,
                amount: session.amount || 0,
                notes: session.notes,
                babalawo_id: session.babalawo_id,
                babalawo_name: babalawoName, // Standardized field with consistent naming
                babalawo_avatar: profile?.avatar_url || null,
                babalawo_specialties: babalawoData?.specialties || [],
                session_type: (session as { session_type?: string }).session_type ?? 'consultation',
                primary_odu: session.primary_odu,
                other_odus: session.other_odus || [],
                ritual_recommendations: session.ritual_recommendations,
                items_needed: Array.isArray(session.items_needed) ? session.items_needed.map(String) : session.items_needed ? [String(session.items_needed)] : null,
                deadline: session.deadline,
                next_appointment: session.next_appointment,
                warnings: null, // Not in database yet
                consultation_notes: null, // Not in database yet
                is_instant: session.is_instant, // Add this line
            };
        });

        console.log('[useUserSessions] Transformed sessions:', transformedSessions);
        return transformedSessions;
        
    } catch (err: any) {
        console.error('[useUserSessions] Error fetching sessions:', err);
        const appError = errorService.handleError(err, 'FETCH_USER_SESSIONS');
        errorService.showErrorToast(appError);
        return [];
    }
};

export const useUserSessions = () => {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: ['userSessions', user?.id],
        queryFn: () => fetchUserSessions(user?.id),
        enabled: !!user,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: (failureCount, error) => {
            // Retry up to 3 times for retryable errors
            if (failureCount < 3) {
                const appError = errorService.handleError(error, 'RETRY_USER_SESSIONS');
                return appError.retryable || false;
            }
            return false;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
};
