# Payments database scenarios

Walks the money rules (top-ups, wallet booking, escrow release, withdrawals,
refunds, slot races) on the full schema (plain Postgres, all of
`db/migrations` applied).

```bash
createdb pay_test
DATABASE_URL=postgres://localhost/pay_test npm --prefix server run migrate
psql -d pay_test -f db/tests/payments/10_scenarios.sql
```
Read the output: every "ERROR" is an attack or bad input that is *supposed* to be refused
(for example "Admin only", "permission denied", "Insufficient available balance").
