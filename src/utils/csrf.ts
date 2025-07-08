import { supabase } from '@/integrations/supabase/client';

// Function to get the CSRF token from the session
export const getCsrfToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

// Function to include the CSRF token in a request header
export const withCsrf = async (headers: HeadersInit = {}): Promise<HeadersInit> => {
  const token = await getCsrfToken();
  if (token) {
    return {
      ...headers,
      'X-CSRF-Token': token,
    };
  }
  return headers;
};
