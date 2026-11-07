# Payments database scenarios

Runs the money rules in `20261108000200_payments_core.sql` against a throwaway Postgres with stubbed
Supabase pieces (`auth.uid()`, roles). Not a replacement for testing on a Supabase branch database.

```bash
createdb pay_test
psql -d pay_test -v ON_ERROR_STOP=1 -f supabase/tests/payments/00_stub_schema.sql
# scenarios expect the migration to be applied after the extra scheduling tables created at the top of 10_scenarios.sql
psql -d pay_test -f supabase/migrations/20261108000200_payments_core.sql
psql -d pay_test -f supabase/tests/payments/10_scenarios.sql
```
Read the output: every "ERROR" in sections 1 and 3 is an attack or bad input that is *supposed* to be refused.
