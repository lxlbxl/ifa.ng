-- Let admins update the platform defaults and, when explicitly requested,
-- synchronize the same split to every Babalawo in one transaction.
CREATE OR REPLACE FUNCTION public.admin_update_commission_split(
  p_platform_percent numeric,
  p_babalawo_percent numeric,
  p_apply_to_all boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  IF p_platform_percent < 0 OR p_platform_percent > 100
     OR p_babalawo_percent < 0 OR p_babalawo_percent > 100
     OR p_platform_percent + p_babalawo_percent <> 100 THEN
    RAISE EXCEPTION 'Commission shares must be between 0 and 100 and total 100';
  END IF;

  INSERT INTO public.admin_settings (setting_key, setting_value, description, is_public)
  VALUES
    ('platform_commission_percent', p_platform_percent::text, 'Platform share of each paid consultation, in percent', true),
    ('babalawo_commission_percent', p_babalawo_percent::text, 'Babalawo share of each paid consultation, in percent', true)
  ON CONFLICT (setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        is_public = EXCLUDED.is_public;

  IF p_apply_to_all THEN
    UPDATE public.babalawos
       SET commission_platform_percent = p_platform_percent,
           commission_babalawo_percent = p_babalawo_percent;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('updated_babalawos', v_updated_count);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_commission_split(numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_commission_split(numeric, numeric, boolean) TO authenticated;
