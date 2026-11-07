
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, AuthError, User, AuthResponse } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
type Profile = Database['public']['Tables']['profiles']['Row'];
export type AppRole = Database['public']['Enums']['user_role'];

// Enhanced auth error response type
interface AuthErrorResponse {
  error: AuthError | Error | null;
  message: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: Profile | null;
  /** Authoritative roles, read from the user_roles table (never from profiles.role). */
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'user' | 'babalawo'
  ) => Promise<AuthErrorResponse>;
  signIn: (email: string, password: string) => Promise<AuthErrorResponse>;
  refreshSession: () => Promise<AuthErrorResponse>;
  updateProfile: (data: Partial<Profile>) => Promise<AuthErrorResponse>;
  isProfileComplete: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const { toast } = useToast();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(false);

  const getProfile = useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setUserProfile(null);
        setRoles([]);
        setIsProfileComplete(false);
        setLoading(false);
        return;
      }

      const rolesResult = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const fetchedRoles: AppRole[] = rolesResult.error
        ? []
        : (rolesResult.data ?? []).map((r) => r.role as AppRole);
      setRoles(fetchedRoles);
      
      // Attempt to fetch user profile with retries
      let attempts = 0;
      const maxAttempts = 3;
      let profile = null;
      let error = null;
      
      while (attempts < maxAttempts) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
          
        if (!result.error) {
          profile = result.data;
          break;
        }
        
        error = result.error;
        
        // Profiles are created by the handle_new_user database trigger; the client
        // never creates one (and can never choose its own role).
        attempts++;
        
        // Wait before retrying (exponential backoff)
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (error) {
        console.error('Error fetching profile:', error);
        setUserProfile(null);
        setIsProfileComplete(false);
      } else if (profile) {
        setUserProfile(profile);
        
        // Check if profile is complete (has required fields)
        const isComplete = Boolean(profile.full_name && profile.email);
        setIsProfileComplete(isComplete);
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      setUserProfile(null);
      setIsProfileComplete(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // Listen for Supabase auth events FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setTimeout(() => {
        getProfile();
      }, 0);
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [getProfile]);

  useEffect(() => {
    if (user) {
      getProfile();
    } else {
      setLoading(false);
    }
  }, [user, getProfile]);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        });
      }
      
      // Clear user data regardless of error to prevent UI confusion
      setUserProfile(null);
      setRoles([]);
      setIsProfileComplete(false);
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    await getProfile();
  };

  // Try to refresh the session when it expires
  const refreshSession = async (): Promise<AuthErrorResponse> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh failed:', error);
        return { 
          error, 
          message: error.message || 'Session refresh failed' 
        };
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      
      return { error: null, message: 'Session refreshed successfully' };
    } catch (error) {
      const err = error as Error;
      console.error('Unexpected error during session refresh:', err);
      return { 
        error: err, 
        message: err.message || 'Unexpected error during session refresh' 
      };
    } finally {
      setLoading(false);
    }
  };
  
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'user' | 'babalawo'
  ): Promise<AuthErrorResponse> => {
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
          emailRedirectTo: redirectUrl,
        },
      });
      
      if (error) {
        return { error, message: error.message };
      }
      
      // Check if email confirmation is required
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { 
          error: null, 
          message: 'Account already exists. Please sign in instead.' 
        };
      }
      
      return { error: null, message: 'Sign up successful. Please check your email to confirm your account.' };
    } catch (error) {
      const err = error as Error;
      console.error('Unexpected error during sign up:', err);
      return { 
        error: err, 
        message: err.message || 'An unexpected error occurred during sign up' 
      };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthErrorResponse> => {
    try {
      setLoading(true);
      setAuthError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) {
        setAuthError(error);
        return { error, message: error.message };
      }
      
      // Success, update local state
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      
      return { error: null, message: 'Signed in successfully' };
    } catch (error) {
      const err = error as Error;
      console.error('Unexpected error during sign in:', err);
      return { 
        error: err, 
        message: err.message || 'An unexpected error occurred during sign in' 
      };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<Profile>): Promise<AuthErrorResponse> => {
    try {
      setLoading(true);
      
      if (!user?.id) {
        return { 
          error: new Error("No user found"), 
          message: "You must be logged in to update your profile" 
        };
      }
      
      // First, get the current profile to merge with updates
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (fetchError) {
        console.error('Error fetching current profile:', fetchError);
        return { 
          error: fetchError, 
          message: fetchError.message || 'Failed to fetch current profile' 
        };
      }
      
      // Merge current profile with updates. Identity and privilege fields are never
      // sent from the client (the database also rejects changes to them).
      const {
        id: _id, role: _role, email: _email, created_at: _created,
        ...safeData
      } = data as Record<string, unknown>;
      const updatedProfile = {
        ...currentProfile,
        ...safeData,
        updated_at: new Date().toISOString(),
      };
      
      // Update the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updatedProfile)
        .eq('id', user.id);
      
      if (updateError) {
        console.error('Error updating profile:', updateError);
        return { 
          error: updateError, 
          message: updateError.message || 'Failed to update profile' 
        };
      }
      
      // Refresh the profile
      await getProfile();
      
      return { error: null, message: 'Profile updated successfully' };
    } catch (error) {
      const err = error as Error;
      console.error('Unexpected error updating profile:', err);
      return { 
        error: err, 
        message: err.message || 'An unexpected error occurred updating your profile' 
      };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userProfile,
        roles,
        hasRole: (role: AppRole) => roles.includes(role),
        isAdmin: roles.includes('admin'),
        loading,
        signOut,
        refreshProfile,
        signUp,
        signIn,
        refreshSession,
        updateProfile,
        isProfileComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
