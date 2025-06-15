
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchRecentSignups = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at, avatar_url')
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching recent signups:', error);
        throw new Error('Could not fetch recent signups');
    }
    return data;
};

export const useRecentSignups = () => {
    return useQuery({
        queryKey: ['recentSignups'],
        queryFn: fetchRecentSignups,
    });
};
