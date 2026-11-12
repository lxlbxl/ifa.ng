-- Remove every demo account and everything attached to it, before real people use IFA.ng.
--
-- Demo accounts are the ones run-demo-seed.sh created, all with emails ending @demo.ifa.test
-- (including the demo admin, which signs in with a password). Their sessions, payments, wallets,
-- notes, files records and audit entries go with them. Real accounts are not touched.
--
-- Run on the server (it prints what it would remove, then removes it in one transaction):
--   docker compose -f compose.yml exec -T db psql -U ifa_admin -d ifa -v ON_ERROR_STOP=1 < remove-demo.sql
-- Then delete the demo files from storage and the local demo-credentials.json / DEMO-ACCESS.md.

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE demo_users ON COMMIT DROP AS
  SELECT id FROM auth.users WHERE email ILIKE '%@demo.ifa.test';

SELECT count(*) AS demo_accounts FROM demo_users;
SELECT count(*) AS demo_sessions FROM public.sessions
 WHERE user_id IN (SELECT id FROM demo_users) OR babalawo_id IN (SELECT id FROM demo_users);

-- The one link that doesn't cascade: notes approved by a demo Babalawo.
DELETE FROM public.consultation_notes
 WHERE approved_by IN (SELECT id FROM demo_users)
    OR session_id IN (SELECT id FROM public.sessions WHERE user_id IN (SELECT id FROM demo_users) OR babalawo_id IN (SELECT id FROM demo_users));

-- The seed's own marker and audit rows.
DELETE FROM public.admin_audit_log
 WHERE admin_id IN (SELECT id FROM demo_users) OR target_id IN (SELECT id::text FROM demo_users) OR details::text ILIKE '%[DEMO]%';

-- Everything else cascades from the user.
DELETE FROM auth.users WHERE id IN (SELECT id FROM demo_users);

SELECT count(*) AS demo_accounts_left FROM auth.users WHERE email ILIKE '%@demo.ifa.test';
COMMIT;
