-- Provider keys managed from Admin -> Settings -> Integrations.
--
-- Values are encrypted by the API (AES-256-GCM, key from SETTINGS_ENCRYPTION_KEY, which never
-- reaches the database) before they are stored. They live in their own schema, "private", which
-- PostgREST does not serve (PGRST_DB_SCHEMAS=public) and which anon / authenticated cannot even
-- see: only the API and the recording worker, acting as service_role, read and write them.
-- A value saved here takes priority over the same name in the server's .env; deleting it falls
-- back to .env. Who changed what (never the value) goes to public.admin_audit_log.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON SCHEMA private FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON SCHEMA private FROM authenticated'; END IF;
END $$;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.integration_secrets (
  env_key    text PRIMARY KEY CHECK (env_key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  value_enc  text NOT NULL CHECK (value_enc LIKE 'v1:%'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

REVOKE ALL ON private.integration_secrets FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON private.integration_secrets FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON private.integration_secrets FROM authenticated'; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.integration_secrets TO service_role;
