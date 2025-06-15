
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchAdminBabalawos = async () => {
    const { data, error } = await supabase
        .from('babalawos')
        .select(`
            id, 
            bio, 
            experience_years, 
            hourly_rate, 
            is_active, 
            languages, 
            rating, 
            specialties, 
            timezone, 
            total_sessions, 
            verification_status,
            created_at
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching babalawos for admin:', error);
        throw new Error(error.message);
    }
    return data;
};

export const useAdminBabalawos = () => {
    return useQuery({
        queryKey: ['adminBabalawos'],
        queryFn: fetchAdminBabalawos,
    });
};
