-- Function to get all public babalawo profiles
-- This function uses SECURITY DEFINER to bypass RLS and safely join profiles.
CREATE OR REPLACE FUNCTION get_public_babalawos()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    avatar_url TEXT,
    specialties TEXT[],
    experience_years INTEGER,
    hourly_rate DECIMAL,
    bio TEXT,
    verification_status verification_status,
    rating DECIMAL,
    total_sessions INTEGER,
    languages TEXT[],
    timezone TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        p.full_name,
        p.avatar_url,
        b.specialties,
        b.experience_years,
        b.hourly_rate,
        b.bio,
        b.verification_status,
        b.rating,
        b.total_sessions,
        b.languages,
        b.timezone,
        b.is_active
    FROM
        babalawos b
    JOIN
        profiles p ON b.id = p.id
    WHERE
        b.verification_status = 'approved' AND b.is_active = true;
END;
$$;

-- Function to get babalawo details for a given list of IDs
-- This function also uses SECURITY DEFINER to safely fetch profile and babalawo data.
CREATE OR REPLACE FUNCTION get_babalawo_details_by_ids(p_ids UUID[])
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    avatar_url TEXT,
    specialties TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.avatar_url,
        b.specialties
    FROM
        profiles p
    LEFT JOIN
        babalawos b ON p.id = b.id
    WHERE
        p.id = ANY(p_ids);
END;
$$;
