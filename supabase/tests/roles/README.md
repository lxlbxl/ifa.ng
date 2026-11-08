# Roles / sessions security tests

Runs the roles migration and the sessions hardening migration against a throwaway
Postgres (stubbed `auth` schema, no Supabase needed) and tries to break them.

    createdb ifa_roles_test
    psql -v ON_ERROR_STOP=1 -d ifa_roles_test \
      -f supabase/tests/roles/00_stub_schema.sql \
      -f supabase/migrations/20261108000100_roles_and_admin_hardening.sql \
      -f supabase/migrations/20261108000150_sessions_access_hardening.sql \
      -f supabase/tests/roles/10_attacks.sql
    dropdb ifa_roles_test

Prints `ok (blocked)` / `ok (allowed)` per case and `ALL CHECKS PASSED`; any attack that
succeeds aborts the run. Must be run as a superuser (it switches to the `authenticated` role).
