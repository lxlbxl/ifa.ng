import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Review {
  id: number;
  session_id: number;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const fetchBabalawoReviews = async (babalawoId: string) => {
  // First get the babalawo record to find which sessions belong to this babalawo
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('babalawo_id', babalawoId);

  if (!sessions || sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map(s => s.id);

  const { data: reviewsData, error: reviewsError } = await supabase
    .from('reviews')
    .select(`
      id,
      session_id,
      user_id,
      rating,
      comment,
      created_at
    `)
    .in('session_id', sessionIds)
    .order('created_at', { ascending: false });

  if (reviewsError) {
    throw reviewsError;
  }

  if (!reviewsData || reviewsData.length === 0) {
    return [];
  }

  const userIds = Array.from(new Set(reviewsData.map(r => r.user_id).filter(Boolean)));

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  if (profilesError) {
    throw profilesError;
  }

  const profilesMap = new Map(profilesData?.map(p => [p.id, p]) ?? []);

  const reviewsWithUser = reviewsData.map(review => ({
    ...review,
    user: profilesMap.get(review.user_id) ?? null,
  }));

  return reviewsWithUser as Review[];
};

export const useBabalawoReviews = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['babalawoReviews', user?.id],
    queryFn: () => user?.id ? fetchBabalawoReviews(user.id) : [],
    enabled: !!user?.id,
  });
};