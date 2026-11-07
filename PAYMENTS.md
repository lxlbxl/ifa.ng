# Payments & wallet: how money moves

**Rule: the browser never decides money.** Prices, balances, refunds and payouts are computed in Postgres;
card/bank charges are confirmed by asking the provider from an edge function.

## Flows
| Flow | Entry point | What happens |
|---|---|---|
| Pay from wallet | RPC `book_session_with_wallet` | one DB transaction: availability check, price lookup, wallet debit, session (paid), payment row, babalawo escrow |
| Pay by card / transfer | edge `payment-init` -> popup -> edge `payment-verify` (+ provider webhook) | intent created with server price; provider re-queried; `settle_payment_intent` creates the paid session once; then `create-meet-link` is requested |
| Wallet top-up | same as above with `kind: wallet_topup` | wallet credited only by settlement |
| Session completed | trigger on `sessions.status` | babalawo's held earnings (`pending_balance`) move to `available_balance`, once per session |
| Cancel / refund | RPC `cancel_session`, `admin_refund_session` | refund to client wallet, babalawo earnings reversed, one refund per session |
| Withdrawal | RPC `request_withdrawal` -> admin `admin_process_withdrawal` (approve / reject / mark_paid) | available -> on hold -> paid out (or returned) |
| Babalawo price | RPC `set_my_session_price` | bounded by admin settings `min_session_price` / `max_session_price` |
| Admin view | RPC `admin_transactions`, `admin_finance_summary`; UI in Payments & Finance | |

## Deploy checklist
1. Apply `supabase/migrations/20261108000200_payments_core.sql` (after the roles migration).
2. Set edge function secrets (preferred over `admin_settings`, which is only a fallback):
   `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_PUBLIC_KEY`, `FLW_SECRET_HASH`,
   optional `ALLOWED_ORIGINS` (comma list) and `MEETING_CREATE_FUNCTION` (default `create-meet-link`).
3. Deploy functions: `payment-init`, `payment-verify`, `webhook-paystack`, `webhook-flutterwave`.
4. Point provider dashboards at `https://<project>.supabase.co/functions/v1/webhook-paystack` and `.../webhook-flutterwave`.
   Flutterwave "secret hash" must equal `FLW_SECRET_HASH`.
5. Rotate any key that was ever stored in `admin_settings` or committed (the old client code shipped fake default keys).
6. Existing rows: sessions with `payment_status = 'paid'` made before this change have no `babalawo_ledger` entry, so their
   earnings are not in the new wallets. Backfill if real money was involved (see PR notes).
