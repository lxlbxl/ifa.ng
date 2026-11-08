# Roles, admin and session access

## Roles model
- Roles live in `public.user_roles (user_id, role)`; `profiles.role` is only a read-only mirror
  (highest role wins) so old code keeps working. Clients can never write either.
- SQL helpers: `has_role(uid, role)`, `is_admin()`, `get_my_roles()`. Use these in RLS, never `profiles.role`.
- Client: `useAuth()` exposes `roles`, `hasRole(role)`, `isAdmin`.
- Signup can only choose `user` or `babalawo`. A new Babalawo is unverified and hidden until an admin approves
  (`babalawos.review_status`, `admin_review_babalawo`).

## First admin (run once, as the database owner)
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com' on conflict do nothing;
```
After that, admins grant/revoke roles from Admin → Users. Every admin action goes through an
audited `admin_*` function and shows in Admin → Activity. An admin cannot remove their own admin
role or suspend themselves.

## Sessions: who can change what from a client
Enforced by triggers (`guard_session_client_updates`, plus payments' `guard_session_payment_columns`).
Definer functions and the service role bypass them; admins bypass this one.

| Who | May change directly | Everything else |
| --- | --- | --- |
| Client | `status` → `cancelled` only (paid sessions via `cancel_session()`) | server-managed |
| Babalawo | outcome fields (`notes`, `primary_odu`, `other_odus`, `ritual_recommendations`, `items_needed`, `deadline`, `next_appointment`, `warning`); `status` pending→confirmed→in_progress→completed, only when `payment_status='paid'` | server-managed |
| Anyone | cannot delete sessions, reschedule, change parties, room/meeting links, or payment fields | |

Any column added to `sessions` later is server-managed by default: add it to the whitelist in
`20261108000150_sessions_access_hardening.sql` only if a client genuinely needs to write it.

## Tests
`supabase/tests/roles/README.md` — runs the migrations against a scratch Postgres and tries 28 attacks.
