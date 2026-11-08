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

## How the web app reads and writes tables

Exactly as it did on Supabase, through PostgREST, but our own copy on the VPS
(`postgrest` in `deploy/docker-compose.yml`, served at `/rest/v1`). PostgREST logs in
as `ifa_rest`, which can only become `anon` or `authenticated`. A signed-in browser
asks `GET /v1/data-token` for a 10 minute token (signed with `DATA_JWT_SECRET`, which
PostgREST also holds), so every row-level security policy applies unchanged.
`e2e/postgrest.test.ts` runs a real PostgREST in CI to prove it.

## What replaced the edge functions

| Old Supabase function | Now |
| --- | --- |
| payment-init | `POST /v1/payments/init` |
| payment-verify | `POST /v1/payments/verify` |
| webhook-paystack | `POST /webhooks/paystack` |
| webhook-flutterwave | `POST /webhooks/flutterwave` |
| create-meet-link | `POST /v1/sessions/:id/meet-link` (also called by the server after payment) |
| generate-agora-token | `POST /v1/sessions/:id/agora-token` |
| session-media (transcript) | `GET /v1/sessions/:id/transcript` |
| session-media (recording) | `GET /v1/sessions/:id/recording` (10 minute signed link, Babalawo/admin, logged) |
| session-media (upload) | `POST /v1/sessions/:id/audio` (Babalawo, both consents) |
| dispatch-notifications | runs inside the API every minute; admins can trigger `POST /v1/admin/notifications/dispatch` |
| health-check | `GET /health` |
| create-daily-room | dropped (Meet is the default, Agora the fallback) |

Provider keys come only from the server environment (`deploy/.env.example`), never from
`admin_settings`. Tests run against real Postgres with a fake `fetch` standing in for
Paystack, Flutterwave, Google, Termii and WhatsApp (`test/integrations.test.ts`).

## Files, live updates and jobs

- **Files** go to a private R2 bucket (`S3_*` settings), or to the `files` volume when those are empty.
  Profile photos: `POST /v1/me/avatar`, served at `/files/avatars/...`. Session audio is only ever
  reachable through a short signed link.
- **Live notifications**: a trigger on `notifications` does `pg_notify`; the API pushes the row to
  the owner's open `GET /v1/notifications/stream` (Server-Sent Events).
- **Scheduled jobs** run inside the API (`src/services/jobs.ts`): WhatsApp/SMS reminders every
  minute, expired slot holds every minute, finished sessions every 5 minutes.
- **Recording worker** (`workers/recording-processor`, `recorder` in compose) talks to Postgres
  and the same file store directly.

## Status

- [x] Phase 1: skeleton, compat layer, per-request identity, migration runner, CI
- [ ] Baseline schema from the live database (waiting on a schema-only dump)
- [x] Self-hosted deploy: docker compose (Postgres, API, Caddy, offsite backups), see deploy/README.md
- [x] Phase 2: port edge functions (payments, webhooks, Meet, notifications)
- [x] Phase 3: login with Better Auth
- [x] Phase 4: frontend data layer (login, data, payments, video calls)
- [x] Phase 5: files (R2), live notifications (SSE), scheduled jobs, recording worker
- [ ] Phase 6: data migration and cutover
