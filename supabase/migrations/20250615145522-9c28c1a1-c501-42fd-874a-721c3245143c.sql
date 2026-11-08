
-- 1. Security definer helper function for ADMIN role checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. RLS for sessions table

-- Enable RLS if not already enabled
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to see/join their own sessions
CREATE POLICY "Users and Babalawos can view/join their own sessions"
  ON public.sessions
  FOR SELECT
  USING (
    auth.uid() = user_id OR auth.uid() = babalawo_id OR public.is_admin()
  );

-- Allow users to create sessions if they’re the user
CREATE POLICY "Users can create their own sessions"
  ON public.sessions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
  );

-- Allow participants to update sessions they are part of, or admin
CREATE POLICY "Participants and Admin can update sessions"
  ON public.sessions
  FOR UPDATE
  USING (
    auth.uid() = user_id OR auth.uid() = babalawo_id OR public.is_admin()
  );

-- (Optional, for completeness) Allow deleting by participant or admin
CREATE POLICY "Participants and Admin can delete their sessions"
  ON public.sessions
  FOR DELETE
  USING (
    auth.uid() = user_id OR auth.uid() = babalawo_id OR public.is_admin()
  );

-- 3. RLS for availability table

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- Babalawos can manage their own calendar, admins all
CREATE POLICY "Babalawo or Admin can view availability"
  ON public.availability
  FOR SELECT
  USING (
    auth.uid() = babalawo_id OR public.is_admin()
  );

CREATE POLICY "Babalawo or Admin can insert availability"
  ON public.availability
  FOR INSERT
  WITH CHECK (
    auth.uid() = babalawo_id OR public.is_admin()
  );

CREATE POLICY "Babalawo or Admin can update availability"
  ON public.availability
  FOR UPDATE
  USING (
    auth.uid() = babalawo_id OR public.is_admin()
  );

CREATE POLICY "Babalawo or Admin can delete availability"
  ON public.availability
  FOR DELETE
  USING (
    auth.uid() = babalawo_id OR public.is_admin()
  );

-- 4. Secure Supabase Storage for media/profile (avatars bucket, public and permissive)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

-- (Optional) Set RLS for storage.objects (if you want private, ask and I’ll provide a restrictive policy)

-- 5. (Passwords & JWT)
-- Handled by Supabase Auth automatically: no action required

