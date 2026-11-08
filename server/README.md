# IFA.ng API server

The backend that replaces Supabase: one Node/TypeScript service (Hono +
Kysely) in front of plain Postgres. See the migration plan:
https://claude.ai/artifact/Hy3XPmSmQBwd3FYM97FAiX

## How identity reaches the database

The app's RLS policies and SQL functions were written for Supabase and use
`auth.uid()`. `db/compat/000_supabase_compat.sql` recreates that function, the
`anon` / `authenticated` / `service_role` roles, `auth.users` and Supabase's
default grants on plain Postgres. Every request runs in one transaction that
does `SET LOCAL ROLE` plus `set_config('request.jwt.claims', ..., true)`
(`src/db.ts`), so existing policies apply unchanged and nothing leaks between
pooled connections. `test/compat.test.ts` proves this.

## Run locally

```sh
cd server
npm install
export DATABASE_URL=postgres://postgres@localhost:5432/ifa
npm run migrate     # compat layer + db/migrations
npm run dev         # http://localhost:8787/health
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm test
```

## Database role in production

Connect as a dedicated login role that is not a superuser and can switch into
the three API roles:

```sql
create role ifa_api login password '...';
grant anon, authenticated, service_role to ifa_api;
```

## Login

Better Auth runs inside the API at `/api/auth/*` and stores its sessions, password
hashes and verification tokens in the `auth` schema (see
`db/migrations/20261109000000_auth_login_tables.sql`). People keep the same
`auth.users` ids, so every policy and foreign key still works. Browsers get an
httpOnly cookie; the PWA can send `Authorization: Bearer <token>` instead (the token
comes back in the `set-auth-token` header on sign-in). Signup accepts
`signupRole: "user" | "babalawo"` only; admin is never granted at signup.
Emails go through `SMTP_URL`, or are printed to the log when it is unset.

## Status

- [x] Phase 1: skeleton, compat layer, per-request identity, migration runner, CI
- [ ] Baseline schema from the live database (waiting on a schema-only dump)
- [x] Self-hosted deploy: docker compose (Postgres, API, Caddy, offsite backups), see deploy/README.md
- [ ] Phase 2: port edge functions (payments, webhooks, Meet, notifications)
- [x] Phase 3: login with Better Auth
- [ ] Phase 4: frontend data layer
- [ ] Phase 5: files (R2), live notifications (SSE), jobs (pg-boss)
- [ ] Phase 6: data migration and cutover
