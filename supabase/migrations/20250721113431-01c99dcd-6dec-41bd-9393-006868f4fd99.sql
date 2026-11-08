-- Fix the get_public_babalawos function to use correct column name
CREATE OR REPLACE FUNCTION public.get_public_babalawos()
 RETURNS TABLE(id uuid, full_name text, avatar_url text, specialties text[], experience_years integer, hourly_rate numeric, bio text, verification_status text, rating numeric, total_sessions integer, languages text[], timezone text, is_active boolean)
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
        b.experience_years,  -- Updated from years_of_experience
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
$function$