-- Runs after all migrations. Catches anything created before the default
-- privileges applied (for example objects created by an extension).
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- The API's runtime login (created by deploy/postgres/01-api-role.sh) must be
-- able to switch into the three request roles, and nothing more.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ifa_api') THEN
    GRANT anon, authenticated, service_role TO ifa_api;
  END IF;
END $$;

-- PostgREST's login (deploy/postgres/01-api-role.sh): anon and authenticated only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ifa_rest') THEN
    GRANT anon, authenticated TO ifa_rest;
  END IF;
END $$;

-- Tell a running PostgREST to reload its view of the schema after migrations.
NOTIFY pgrst, 'reload schema';
