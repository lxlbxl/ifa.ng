
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const fetchUserSessions = async (userId: string | undefined) => {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('sessions')
        .select(`
            id,
            session_date,
            start_time,
            end_time,
            status,
            babalawos (
                id,
                specialties,
                profiles (
                    full_name,
                    avatar_url
                )
            )
        `)
        .eq('user_id', userId)
        .order('session_date', { ascending: true });

    if (error) {
        console.error('Error fetching user sessions:', error);
        throw new Error(error.message);
    }
    
    return data || [];
};

export const useUserSessions = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['userSessions', user?.id],
        queryFn: () => fetchUserSessions(user?.id),
        enabled: !!user,
    });
};
