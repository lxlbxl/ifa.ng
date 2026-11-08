# Roles / sessions security tests

Tries to break the roles, admin and session rules on the full schema
(plain Postgres, all of `db/migrations` applied). Runs in CI as part of
`server/test/db-security.test.ts`. To run by hand:

    createdb ifa_roles_test
    DATABASE_URL=postgres://localhost/ifa_roles_test npm --prefix server run migrate
    psql -v ON_ERROR_STOP=1 -d ifa_roles_test -f db/tests/roles/10_attacks.sql
    dropdb ifa_roles_test

Prints `ok (blocked)` / `ok (allowed)` per case and `ALL CHECKS PASSED`; any attack that
succeeds aborts the run. Must be run as a superuser (it switches to the `authenticated` role).
