
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

    // Now fetch babalawo details for each session
    if (data && data.length > 0) {
        const babalawosData = await Promise.all(
            data.map(async (session) => {
                const { data: babalawos, error: babalawosError } = await supabase
                    .from('babalawos')
                    .select(`
                        id,
                        specialties,
                        profiles (
                            full_name,
                            avatar_url
                        )
                    `)
                    .eq('id', session.babalawo_id)
                    .single();

                if (babalawosError) {
                    console.error('Error fetching babalawo:', babalawosError);
                    return { ...session, babalawos: null };
                }

                return { ...session, babalawos };
            })
        );

        return babalawosData;
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
