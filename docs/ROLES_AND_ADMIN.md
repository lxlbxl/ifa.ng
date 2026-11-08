# Roles, admin and session access

## Roles model
- Roles live in `public.user_roles (user_id, role)`; `profiles.role` is only a read-only mirror
  (highest role wins) so old code keeps working. Clients can never write either.
- SQL helpers: `has_role(uid, role)`, `is_admin()`, `get_my_roles()`. Use these in RLS, never `profiles.role`.
- Client: `useAuth()` exposes `roles`, `hasRole(role)`, `isAdmin`.
- Signup can only choose `user` or `babalawo`. A new Babalawo is unverified and hidden until an admin approves
  (`babalawos.review_status`, `admin_review_babalawo`).

## First admin (run once, as the database owner)
Sign in once at /auth with your phone number (code, then PIN), then:
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where phone = '+2348012345678' on conflict do nothing;
```

## Login and Babalawo applications
- People sign in with phone + 4-digit PIN (`/api/auth/phone/*`, server/src/services/phoneAuth.ts). New numbers get a
  6-digit code by SMS/WhatsApp (Termii), then choose a PIN. Email sign-up is off (`EMAIL_SIGNUP=false`).
- Limits: a new code every 60 s, 5 codes per number and 20 per IP per hour, 5 wrong tries per code; 5 wrong PINs lock
  the PIN for 15 min, doubling each time (max 24 h). "Forgot PIN" sends a fresh code.
- Without `TERMII_API_KEY`, outside production, codes are shown in the app ("test mode") instead of sent.
- Babalawos apply at `/become-a-babalawo` (`babalawo_applications`, status `waitlisted`). Admin → Applications approves
  (`admin_review_babalawo_application`): that grants the babalawo role and creates a verified Babalawo profile.
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
