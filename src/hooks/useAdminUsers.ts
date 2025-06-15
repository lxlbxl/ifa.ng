
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchAdminUsers = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, created_at, avatar_url')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users for admin:', error);
        throw new Error(error.message);
    }
    return data;
};

export const useAdminUsers = () => {
    return useQuery({
        queryKey: ['adminUsers'],
        queryFn: fetchAdminUsers,
    });
};
