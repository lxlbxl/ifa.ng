-- Fix babalawos table RLS policies to allow public access for verified babalawos
-- Enable RLS on babalawos table
ALTER TABLE public.babalawos ENABLE ROW LEVEL SECURITY;

-- Allow public to view verified and active babalawos
CREATE POLICY "Public can view verified active babalawos" 
ON public.babalawos 
FOR SELECT 
USING (is_verified = true AND is_active = true);

-- Allow babalawos to view and update their own profiles
CREATE POLICY "Babalawos can manage their own profile" 
ON public.babalawos 
FOR ALL 
USING (user_id = auth.uid());

-- Allow admins to manage all babalawo profiles
CREATE POLICY "Admins can manage all babalawo profiles" 
ON public.babalawos 
FOR ALL 
USING (is_admin());

-- Fix the get_public_babalawos function to use correct field names
CREATE OR REPLACE FUNCTION public.get_public_babalawos()
RETURNS TABLE(
    id uuid, 
    full_name text, 
    avatar_url text, 
    specialties text[], 
    experience_years integer, 
    hourly_rate numeric, 
    bio text, 
    verification_status text, 
    rating numeric, 
    total_sessions integer, 
    languages text[], 
    timezone text, 
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        b.user_id as id,
        p.full_name,
        p.avatar_url,
        b.specialties,
        b.years_of_experience,
        b.hourly_rate,
        b.bio,
        CASE WHEN b.is_verified THEN 'approved' ELSE 'pending' END::text as verification_status,
        b.rating,
        b.total_sessions,
        b.languages,
        b.timezone,
        b.is_active
    FROM
        babalawos b
    JOIN
        profiles p ON b.user_id = p.id
    WHERE
        b.is_verified = true 
        AND b.is_active = true;
END;
$function$;