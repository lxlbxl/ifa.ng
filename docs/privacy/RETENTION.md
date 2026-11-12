# Retention schedule

All periods are editable in **Admin → Privacy & data → Settings** (stored in `admin_settings`) and are shown in the
privacy policy. `public.run_retention()` runs every hour from the API (`server/src/services/jobs.ts`) and records what
it removed in `public.retention_runs`. Files are deleted from storage through `private.storage_deletions`
(every 5 minutes); the recording worker deletes expired recordings too.

| Data | Period (default) | Setting | How |
|---|---|---|---|
| Account, profile | Until the account is deleted | — | `delete_my_account()` / `admin_erase_user()` |
| Consultation notes, Ebo details | Until the account is deleted or erasure is requested | — | erasure |
| Recordings (our storage) | 90 days, or immediately on consent withdrawal / erasure | `recording_retention_days` | worker + `run_retention()` |
| Meet originals in Google Drive | Same as recordings | — | worker with `GOOGLE_DRIVE_DELETE=true`, or a Drive retention rule |
| Transcripts | Same as recordings | `recording_retention_days` | `run_retention()` |
| Ebo proof videos | 365 days after the Ebo is closed | `retention_ebo_proof_days` | `run_retention()` |
| Payments, wallet, refunds, payouts, ledgers | 6 years (pseudonymised after erasure) | `retention_financial_years` | kept; review before deleting anything financial |
| In-app notifications | 365 days | `retention_notifications_days` | `run_retention()` |
| WhatsApp/SMS delivery log (`notification_outbox`) | 90 days | `retention_message_log_days` | `run_retention()` |
| Sign-in codes | 30 days at most | `retention_security_log_days` (capped at 30) | `run_retention()` |
| Expired sign-in sessions (IP, device) | 90 days after expiry | `retention_security_log_days` | `run_retention()` |
| IP/device in the payment audit log | 90 days, then blanked | `retention_security_log_days` | `run_retention()` |
| Rate-limit records | 7 days | — | `run_retention()` |
| Session join/leave logs | 730 days | `retention_session_log_days` | `run_retention()` |
| Declined Babalawo applications | 365 days | `retention_applications_days` | `run_retention()` |
| Push subscriptions unused for 270 days | 270 days | — | `run_retention()` |
| Admin and payment audit logs | 6 years | `retention_audit_years` | `run_retention()` |
| Closed privacy requests | 3 years | `retention_privacy_requests_years` | `run_retention()` |
| Closed breach records | 5 years (or the request period if longer) | — | `run_retention()` |
| Consent log | While the account exists, then kept as proof (pseudonymised) | — | kept |
| Backups | 7 days on the VPS, 30 days offsite | `BACKUP_KEEP_LOCAL`, `BACKUP_KEEP_REMOTE` | `deploy/backup/backup.sh` |

**Erasure keeps** (and why): payment, wallet and payout rows (tax and company law), the date/amount of sessions
(the Babalawo's own records), approved notes on sessions where the erased person was the Babalawo (they are the
client's data), consent records (proof), audit logs (accountability). Each is stripped of name, phone, email and
photo.
