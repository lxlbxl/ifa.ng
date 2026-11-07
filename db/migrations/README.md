# Migrations

The baseline here will be a schema-only dump of the live Supabase database
(`pg_dump --schema-only`), because the old Supabase migration history does not
replay cleanly on an empty database: several tables were changed in the
Supabase dashboard and never written back into migrations.

Name new files `YYYYMMDDHHMMSS_short_name.sql`. `npm run migrate` in
`server/` applies `db/compat/000_*`, then every file here once in name order,
then `db/compat/999_*`.
