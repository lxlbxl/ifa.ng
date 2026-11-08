
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AdminBabalawoData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  specialties: string[] | null;
  experience_years: number | null;
  hourly_rate: number | null;
  bio: string | null;
  rating: number | null;
  total_sessions: number | null;
  languages: string[] | null;
  timezone: string | null;
  is_active: boolean | null;
  is_verified: boolean;
  is_featured: boolean;
  current_status: string;
  review_status: string;
  review_notes: string | null;
}

const fetchAdminBabalawos = async (): Promise<AdminBabalawoData[]> => {
  // Get babalawo data with profile information
  const { data: babalawoData, error: babalawoError } = await supabase
    .from('babalawos')
    .select(`
      user_id,
      bio, 
      experience_years, 
      hourly_rate, 
      is_active, 
      languages, 
      rating, 
      specialties, 
      timezone, 
      total_sessions, 
      is_verified,
      is_featured,
      current_status,
      review_status,
      review_notes,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (babalawoError) {
    console.error('Error fetching babalawos for admin:', babalawoError);
    throw new Error(babalawoError.message);
  }

  // Get corresponding profile data
  const userIds = babalawoData?.map(b => b.user_id) || [];
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  if (profileError) {
    console.error('Error fetching profiles for admin babalawos:', profileError);
    throw new Error(profileError.message);
  }

  // Combine data
  const combinedData: AdminBabalawoData[] = babalawoData?.map(babalawo => {
    const profile = profileData?.find(p => p.id === babalawo.user_id);
    return {
      id: babalawo.user_id,
      full_name: profile?.full_name || '',
      avatar_url: profile?.avatar_url || null,
      specialties: babalawo.specialties,
      experience_years: babalawo.experience_years,
      hourly_rate: babalawo.hourly_rate,
      bio: babalawo.bio,
      rating: babalawo.rating,
      total_sessions: babalawo.total_sessions,
      languages: babalawo.languages,
      timezone: babalawo.timezone,
      is_active: babalawo.is_active,
      is_verified: babalawo.is_verified,
      is_featured: babalawo.is_featured || false,
      current_status: babalawo.current_status || 'offline',
      review_status: babalawo.review_status,
      review_notes: babalawo.review_notes,
    };
  }) || [];

  return combinedData;
};

export const useAdminBabalawos = () => {
  return useQuery({
    queryKey: ['adminBabalawos'],
    queryFn: fetchAdminBabalawos,
  });
};
