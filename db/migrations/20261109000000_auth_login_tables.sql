-- Login for plain Postgres (replaces Supabase Auth).
--
-- The API server runs Better Auth against the `auth` schema. People stay in
-- auth.users (same uuid ids every foreign key already points at); Better Auth
-- adds its own sessions, accounts (password hashes) and verification tokens.
-- Better Auth connects as service_role; browsers never touch these tables.

-- Columns Better Auth needs on the user record.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
-- What the person picked at signup ('user' or 'babalawo'). handle_new_user()
-- reads it from raw_user_meta_data and never grants 'admin'.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS signup_role text;

-- Keep the Supabase-style fields that the app's triggers read in step with
-- the Better Auth fields.
CREATE OR REPLACE FUNCTION auth.sync_user_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.email := lower(NEW.email);
  IF TG_OP = 'INSERT' THEN
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'full_name', NULLIF(NEW.name, ''),
           'role', CASE WHEN NEW.signup_role IN ('user', 'babalawo') THEN NEW.signup_role END));
  END IF;
  IF NEW.email_verified AND NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  ELSIF NOT NEW.email_verified THEN
    NEW.email_confirmed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_sync_fields ON auth.users;
CREATE TRIGGER users_sync_fields BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.sync_user_fields();

-- Profile name follows the account name.
CREATE OR REPLACE FUNCTION auth.sync_profile_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name AND NEW.name <> '' THEN
    UPDATE public.profiles SET full_name = NEW.name WHERE id = NEW.id;
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_sync_profile ON auth.users;
CREATE TRIGGER users_sync_profile AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.sync_profile_name();

CREATE TABLE IF NOT EXISTS auth.sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON auth.sessions(user_id);

CREATE TABLE IF NOT EXISTS auth.accounts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id                text NOT NULL,
  provider_id               text NOT NULL,
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  password                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, account_id)
);
CREATE INDEX IF NOT EXISTS accounts_user_idx ON auth.accounts(user_id);

CREATE TABLE IF NOT EXISTS auth.verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON auth.verifications(identifier);

REVOKE ALL ON auth.sessions, auth.accounts, auth.verifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON auth.users, auth.sessions, auth.accounts, auth.verifications TO service_role;
