# Migrations (plain Postgres)

This folder is the source of truth for the database schema. `npm run migrate`
in `server/` applies `db/compat/000_*`, then every file here once in name
order, then `db/compat/999_*`.

## How the schema was rebuilt

The live Supabase project is no longer accessible, and the old
`supabase/migrations` history does not replay on an empty database (tables
were changed in the Supabase dashboard and never written back). So:

- `20250808000000_baseline_live_schema.sql` rebuilds the schema as it ran on
  Supabase from the last Supabase-generated type file (2025-08-08, kept as
  `db/reference/supabase-types-2025-08-08.json`). `server/test/schema.test.ts`
  checks every table, column, type, nullability, enum and function against it.
- `20260118000000_booking_locks_notifications_audit.sql` keeps the parts of
  the January 2026 work that the app calls (slot locks, notification helpers,
  payment audit log, booking checks), rewritten for the baseline.
- Later migrations (roles/admin, sessions hardening, payments, Meet, PWA)
  were written for Supabase and apply unchanged on top of these.

No production data or user accounts carry over: the new database starts empty.

## Conventions

- Person ids (`user_id`, `babalawo_id` holding a person) are `uuid` = `auth.users.id`.
- `babalawos.id`, `sessions.id`, `reviews.id` are `bigint` identities; every `session_id` is `bigint`.
- Name new files `YYYYMMDDHHMMSS_short_name.sql`.
