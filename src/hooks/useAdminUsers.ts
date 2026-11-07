import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/hooks/useAuth';

export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
  suspended_reason: string | null;
  roles: AppRole[];
}

const fetchAdminUsers = async (): Promise<AdminUser[]> => {
  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, created_at, avatar_url, is_suspended, suspended_reason')
      .order('created_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (rolesRes.error) throw new Error(rolesRes.error.message);

  const byUser = new Map<string, AppRole[]>();
  for (const r of rolesRes.data ?? []) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role as AppRole]);
  }
  return (profilesRes.data ?? []).map((p) => ({
    ...p,
    is_suspended: p.is_suspended ?? false,
    roles: byUser.get(p.id) ?? ['user'],
  }));
};

export const useAdminUsers = () =>
  useQuery({ queryKey: ['adminUsers'], queryFn: fetchAdminUsers });
