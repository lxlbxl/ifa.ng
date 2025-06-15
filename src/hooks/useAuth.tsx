import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Session } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  session: Session | null;
  user: Session['user'] | null;
  userProfile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuth = (): AuthContextType => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const supabaseClient = useSupabaseClient<Database>();

  const getProfile = useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setUserProfile(null);
        return;
      }

      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        setUserProfile(null);
      } else {
        setUserProfile(profile);
      }
    } catch (error) {
      console.error("Unexpected error fetching profile:", error);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, user?.id]);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      getProfile();
    });

    return () => subscription.unsubscribe();
  }, [supabaseClient, getProfile]);

  useEffect(() => {
    if (user) {
      getProfile();
    } else {
      setLoading(false);
    }
  }, [user, getProfile]);

  const signOut = async () => {
    await supabaseClient.auth.signOut();
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    await getProfile();
  };

  // Just a demonstration for your Auth form (insert into your actual sign-up logic):

  // import { isStrongPassword, isValidEmail } from "@/lib/validation";

  // function validateCredentials(email: string, password: string): string | null {
  //   if (!isValidEmail(email)) return "Invalid email format.";
  //   if (!isStrongPassword(password))
  //     return "Password must be at least 8 characters and include uppercase, number, and symbol.";
  //   return null;
  // }

  return {
    session,
    user,
    userProfile,
    loading,
    signOut,
    refreshProfile,
  };
};
