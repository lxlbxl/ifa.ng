
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useBabalawos = () => {
  return useQuery({
    queryKey: ['babalawos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('babalawos')
        .select(`
          *,
          profiles(full_name, avatar_url)
        `)
        .eq('verification_status', 'approved')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(6);

      if (error) throw error;
      return data;
    },
  });
};

export const useBabalawoById = (id: string) => {
  return useQuery({
    queryKey: ['babalawo', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('babalawos')
        .select(`
          *,
          profiles(full_name, avatar_url, email, phone)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};
