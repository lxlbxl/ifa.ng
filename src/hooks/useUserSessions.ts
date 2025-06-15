import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const fetchUserSessions = async (userId: string | undefined) => {
    if (!userId) return [];

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
            babalawo_id
        `)
        .eq('user_id', userId)
        .order('session_date', { ascending: true });

    if (error) {
        console.error('Error fetching user sessions:', error);
        throw new Error(error.message);
    }

    if (!sessions) {
        return [];
    }

    // Now fetch babalawo details for each session
    const sessionsWithBabalawos = await Promise.all(
        sessions.map(async (session) => {
             const { data: babalawoProfile, error: babalawoProfileError } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', session.babalawo_id)
                .single();

            const { data: babalawoData, error: babalawoDataError } = await supabase
                .from('babalawos')
                .select('id, specialties')
                .eq('id', session.babalawo_id)
                .single();

            if (babalawoProfileError || babalawoDataError) {
                console.error('Error fetching babalawo:', babalawoProfileError || babalawoDataError);
                return { ...session, babalawo: null };
            }
            
            const babalawo = {
                ...babalawoData,
                profile: babalawoProfile // Nest profile to match component expectation
            };

            return { ...session, babalawo };
        })
    );

    return sessionsWithBabalawos;
};

export const useUserSessions = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['userSessions', user?.id],
        queryFn: () => fetchUserSessions(user?.id),
        enabled: !!user,
    });
};
